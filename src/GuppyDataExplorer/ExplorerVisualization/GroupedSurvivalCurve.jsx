import React, { useEffect, useState, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { askGuppyForRawData } from '@gen3/guppy/dist/components/Utils/queries';
import { guppyUrl } from '../../localconf';

const GroupedSurvivalCurve = ({ fetchAndUpdateRawData, casecount, guppyConfig }) => {
  const [survivalData, setSurvivalData] = useState({});
  const [startEventType, setStartEventType] = useState('Progression');
  const [endEventType, setEndEventType] = useState('Dead');
  const [groupingField, setGroupingField] = useState('gender');
  const [patientCounts, setPatientCounts] = useState({});
  const [rawData, setRawData] = useState(null);

  const fetchingRef = useRef(false);

  const DATA_LIMIT = 5000;
  const COLORS = ['#2196F3', '#F44336', '#4CAF50', '#FF9800', '#9C27B0'];

  const startEventTypes = ['Diagnose', 'Progression', 'Recurrence', 'Sample', 'Treatment'];
  // const endEventTypes = ['Dead', 'Progression', 'Recurrence', 'Alive']
  const endEventTypeCategories = {
    'Patient Outcome': ['Dead', 'Progression', 'Recurrence', 'Alive'],
    'Other Events': ['days_180_aki', 'days_180_survival', 'days_90_aki', 'days_90_survival']
  };
  
  const groupingFields = [
    { value: 'none', label: 'NO GROUPING' },
    { value: 'gender', label: 'GENDER' },
    { value: 'age_at_index', label: 'AGE AT INDEX' },
    { value: 'ethnicity', label: 'ETHNICITY' },
    { value: 'race', label: 'RACE' },
    { value: 'marital', label: 'MARITAL' },
    { value: 'education', label: 'EDUCATION' },
    { value: 'cur_employ_stat', label: 'CURRENT EMPLOYMENT' }
  ];

  useEffect(() => {
    const fetchData = async () => {
      if (fetchingRef.current || !casecount || casecount <= 0) return;
      
      try {
        fetchingRef.current = true;
        
        const followupRes = await fetchAndUpdateRawData({
          offset: 0,
          size: Math.min(DATA_LIMIT, casecount),
          sort: []
        });

        if (!followupRes?.data) {
          throw new Error('No follow-up data available');
        }

        const followupPatIds = followupRes.data
          .filter(d => d?.pat_id && d.pat_id.length > 0)
          .map(d => d.pat_id[0]);

        if (followupPatIds.length === 0) {
          throw new Error('No valid patient IDs found');
        }

        const demoRes = await askGuppyForRawData(
          guppyUrl,
          "case",
          ['pat_id', 'gender', 'race', 'ethnicity'],
          { 
            pat_id: {
              selectedValues: followupPatIds
            }
          },
          [],
          0,
          followupPatIds.length,
          "all"
        );

        if (!demoRes?.data?.case) {
          throw new Error('Invalid demographic data response');
        }

        console.log ('followupRes', followupRes);
        console.log ('followupPatIds', followupPatIds);
        console.log ('DemoRes', demoRes);
        console.log ('guppyUrl', guppyUrl);
        console.log ('guppyConfig', guppyConfig);
        

        // Clean and validate demographic data
        const cleanedDemoData = demoRes.data.case.filter(demo => {
            if (groupingField === 'none') return true;
            const value = demo[groupingField];
            return value && value.toLowerCase() !== 'unknown';
          });

        const demographicMap = new Map(
          cleanedDemoData.map(demo => [
            demo.pat_id,
            groupingField === "none"? demo : { [groupingField]: demo[groupingField] }
          ])
        );

        const mergedData = {
          ...followupRes,
          data: followupRes.data
            .filter(followup => demographicMap.has(followup.pat_id[0]))
            .map(followup => ({
              ...followup,
              demographic: demographicMap.get(followup.pat_id[0])
            }))
        };

        setRawData(mergedData);

        console.log ('mergedData', mergedData);
        
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        fetchingRef.current = false;
      }
    };

    fetchData();
  }, [casecount, fetchAndUpdateRawData, guppyConfig, groupingField]);

  const calculateSurvivalData = (patients) => {
    if (!patients.length) return [];
    
    patients.sort((a, b) => a.time - b.time);
    
    let alive = patients.length;
    let survivalProb = 1.0;
    const survivalPoints = [{ time: 0, survival: 1.0, alive }];
    
    let currentEvents = [];
    let currentTime = patients[0].time;
  
    for (const patient of patients) {
        if (patient.time !== currentTime) {
            const deaths = currentEvents.filter(p => p.event).length;
            if (alive > 0) {
              survivalProb *= ((alive - deaths) / alive);
              alive -= deaths;
            }
            survivalPoints.push({
              time: currentTime,
              survival: survivalProb,
              alive
            });
            
            currentTime = patient.time;
            currentEvents = [];
          }
  
      currentEvents.push(patient);
    }

    // Handle the last time point
    if (currentEvents.length > 0) {
      const deaths = currentEvents.filter(p => p.event).length;
      if (deaths > 0 && alive > 0) {
        survivalProb *= ((alive - deaths) / alive);
        alive -= deaths;
      }
      survivalPoints.push({
        time: currentTime,
        survival: survivalProb,
        alive
      });
    }
  
    return survivalPoints;
  };

  useEffect(() => {
    const groupedSurvivalData = {};

    if (!rawData?.data || !startEventType || !endEventType) return;
    
    const patientEvents = new Map();
    const groupedPatients = new Map();
    
    // Process and group patient data
    rawData.data.forEach(record => {
      const patId = record.pat_id?.[0];
      if (!patId) return;
      
      const time = parseFloat(record.days_to_follow_up);
      if (isNaN(time)) return;
    
      let groupValue = 'all';
      if (groupingField !== 'none') {
        groupValue = record.demographic[groupingField];
        if (!groupValue) return;
      }
      
      if (!patientEvents.has(patId)) {
        patientEvents.set(patId, []);
        if (!groupedPatients.has(groupValue)) {
          groupedPatients.set(groupValue, new Set());
        }
        groupedPatients.get(groupValue).add(patId);
      }
      
      patientEvents.get(patId).push({
        time,
        eventType: record.event_type,
        patId,
        groupValue
      });
    });

    
    // Calculate survival data for each group

    const counts = {};
    
    groupedPatients.forEach((patientIds, groupValue) => {
      const validPatients = [];
      
      patientIds.forEach(patId => {
        const events = patientEvents.get(patId);
        const startEvent = events.find(e => e.eventType === startEventType);
        
        const allEndEvents = events.filter(e => e.eventType === endEventType);
        const endEvent = allEndEvents.length > 0 ? allEndEvents.reduce((latest, current) => 
          latest.time > current.time ? latest : current) : null;
        
        if (startEvent) {
          if (endEvent && endEvent.time > startEvent.time) {
            validPatients.push({
              time: endEvent.time - startEvent.time,
              event: true,
              patId
            });
          } else {
            const lastFollowUp = Math.max(...events.map(e => e.time));
            validPatients.push({
              time: lastFollowUp - startEvent.time,
              event: false,
              patId
            });
          }
        }
      });
      
      counts[groupValue] = validPatients.length;
      if (validPatients.length > 0) {
        groupedSurvivalData[groupValue] = calculateSurvivalData(validPatients);
      }
    });
    
    setSurvivalData(groupedSurvivalData);
    setPatientCounts(counts);

    console.log('Grouped Counts:', counts);
    console.log('Grouped Survival Data:', groupedSurvivalData);

    
  }, [rawData, startEventType, endEventType, groupingField]);

  const chartData = (() => {
    const timePoints = new Set();
    Object.values(survivalData).forEach(groupData => {
      groupData.forEach(point => timePoints.add(point.time));
    });
  
    const sortedTimes = Array.from(timePoints).sort((a, b) => a - b);
    return sortedTimes.map(time => {
        const point = { time };
        Object.entries(survivalData).forEach(([group, groupData]) => {
            let survivalPoint = groupData.find(p => p.time === time);
            if (!survivalPoint) {
                for (let i = groupData.length - 1; i >= 0; i--) {
                    if (groupData[i].time < time) {
                        survivalPoint = groupData[i];
                        break;
                    }
                }
            }
            point[`survival_${group}`] = survivalPoint ? survivalPoint.survival : 1.0;
        });
        return point;
    });
  })();

  console.log ("chartData", chartData);

  return (
    <div className="w-full p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Grouped Kaplan-Meier Survival Curve</h3>
        <div className="flex gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Start Index</label>
            <select
              value={startEventType}
              onChange={(e) => setStartEventType(e.target.value)}
              className="border rounded p-1 min-w-[150px]"
              disabled={fetchingRef.current}
            >
              {startEventTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Outcome</label>
            <select
              value={endEventType}
              onChange={(e) => setEndEventType(e.target.value)}
              className="border rounded p-1 min-w-[150px]"
              disabled={fetchingRef.current}
            >
              {Object.entries(endEventTypeCategories).map(([category, events]) => (
                <optgroup key={category} label={category}>
                  {events.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
        <label className="block text-sm font-medium mb-1">Group By</label>
        <select
          value={groupingField}
          onChange={(e) => setGroupingField(e.target.value)}
          className="border rounded p-1 min-w-[150px]"
          disabled={fetchingRef.current}
        >
          {groupingFields.map(field => (
            <option key={field.value} value={field.value}>
              {field.label}
            </option>
          ))}
        </select>
      </div>
        </div>
      </div>

      <div className="mb-4 p-2 bg-blue-50 border border-blue-200 rounded">
        <div className="font-medium mb-1">Patients per group:</div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {Object.entries(patientCounts).map(([group, count]) => (
            <div key={group} className="text-sm">
              {group}: {count} patients
            </div>
          ))}
        </div>
        {casecount > DATA_LIMIT && (
          <div className="mt-2 text-sm text-blue-600">
            (Using first {DATA_LIMIT} records)
          </div>
        )}
      </div>

      <div className="w-full h-[400px]">
        {Object.keys(survivalData).length > 0 ? (
          <LineChart
            width={800}
            height={400}
            data={chartData}
            margin={{ top: 20, right: 30, left: 50, bottom: 70 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="time" 
              type="number"
              label={{ value: 'Time (days)', position: 'bottom', offset: 40}} 
            />
            <YAxis 
              domain={[0, 1]} 
              label={{ value: 'Survival Probability', angle: -90, position: 'left' }} 
            />
            <Tooltip 
              formatter={(value, name) => [
                Number(value).toFixed(3), 
                `Survival (${name.split('_')[1]})`
              ]}
              labelFormatter={(label) => `Time: ${label} days`}
            />
            <Legend 
              formatter={(value) => value.split('_')[1]}
              verticalAlign="bottom"
              offset={20} 
            />
            {Object.keys(survivalData).map((group, index) => (
              <Line 
                key={group}
                type="stepAfter"
                dataKey={`survival_${group}`}
                stroke={COLORS[index % COLORS.length]}
                dot={false}
                name={`survival_${group}`}
              />
            ))}
          </LineChart>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500">
            {fetchingRef.current ? 'Loading...' : 'No data available for selected criteria'}
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupedSurvivalCurve;