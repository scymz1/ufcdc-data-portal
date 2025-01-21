import React, { useEffect, useState, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

const FilteredSurvivalCurve = ({ fetchAndUpdateRawData, casecount }) => {
  const [survivalData, setSurvivalData] = useState([]);
  const [startEventType, setStartEventType] = useState('Progression');
  const [endEventType, setEndEventType] = useState('Dead');
  const [patientCount, setPatientCount] = useState(0);
  const [rawData, setRawData] = useState(null);
  const [eventTypes, setEventTypes] = useState([]);
  const fetchingRef = useRef(false);

  const DATA_LIMIT = 5000;

  //pre-defined event type
  const startEventTypes = ['Diagnose', 'Progression', 'Recurrence', 'Sample', 'Treatment'];
  const endEventTypes = ['Dead', 'Progression', 'Recurrence', 'Alive'];


  // // get all event types in data
  // useEffect(() => {
  //   if (!rawData?.data) return;
    
  //   const types = new Set();
  //   rawData.data.forEach(record => {
  //     if (record.event_type) {
  //       types.add(record.event_type);
  //     }
  //   });
    
  //   const sortedTypes = Array.from(types).sort();
  //   setEventTypes(sortedTypes);
    
  //   // set default value if it not included
  //   if (!sortedTypes.includes(startEventType)) {
  //     setStartEventType(sortedTypes[0] || '');
  //   }
  //   if (!sortedTypes.includes(endEventType)) {
  //     setEndEventType(sortedTypes[0] || '');
  //   }
  // }, [rawData]);

  // fetch raw data
  useEffect(() => {
    const fetchData = async () => {
      if (fetchingRef.current) return;
      if (!casecount || casecount <= 0) return;
      
      try {
        fetchingRef.current = true;
        const res = await fetchAndUpdateRawData({
          offset: 0,
          size: Math.min(DATA_LIMIT, casecount),
          sort: []
        });
        setRawData(res);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        fetchingRef.current = false;
      }
    };

    fetchData();
  }, [casecount, fetchAndUpdateRawData]);


  //process survival data
  useEffect(() => {
    if (!rawData?.data) return;
    if (!startEventType || !endEventType) return;
    
    const patientEvents = new Map();
    
    // create timeline for each patId
    rawData.data.forEach(record => {
      const patId = record.pat_id?.[0];
      if (!patId) return;
      
      const time = parseFloat(record.days_to_follow_up);
      if (isNaN(time)) return;
      
      if (!patientEvents.has(patId)) {
        patientEvents.set(patId, []);
      }
      patientEvents.get(patId).push({
        time,
        eventType: record.event_type,
        patId
      });
    });
    
    // filter and calculation
    const validPatients = [];
    patientEvents.forEach((events, patId) => {
      const startEvent = events.find(e => e.eventType === startEventType);
      const endEvent = events.find(e => e.eventType === endEventType);
      
      if (startEvent) {
        if (endEvent && endEvent.time > startEvent.time) {
          validPatients.push({
            time: endEvent.time - startEvent.time,
            event: true,
            patId
          });
        } else {
          // censored data
          const lastFollowUp = Math.max(...events.map(e => e.time));
          validPatients.push({
            time: lastFollowUp - startEvent.time,
            event: false,
            patId
          });
        }
      }
    });
    
    setPatientCount(validPatients.length);
    if (validPatients.length === 0) {
      setSurvivalData([]);
      return;
    }
    
    // sort by time
    validPatients.sort((a, b) => a.time - b.time);
    
    let alive = validPatients.length;
    let survivalProb = 1.0;
    const survivalPoints = [{
      time: 0,
      survival: 1.0,
      alive
    }];
    
    let currentTime = 0;
    let deaths = 0;
    let censored = 0;
    
    validPatients.forEach((patient, index) => {
      if (patient.time !== currentTime) {
        if (deaths > 0 || censored > 0) {
          if (deaths > 0) {
            survivalProb *= (alive - deaths) / alive;
          }
          alive -= (deaths + censored);
          survivalPoints.push({
            time: currentTime,
            survival: survivalProb,
            alive
          });
          deaths = 0;
          censored = 0;
        }
        currentTime = patient.time;
      }
      
      if (patient.event) {
        deaths++;
      } else {
        censored++;
      }
      
      // last point
      if (index === validPatients.length - 1 && (deaths > 0 || censored > 0)) {
        if (deaths > 0) {
          survivalProb *= (alive - deaths) / alive;
        }
        survivalPoints.push({
          time: currentTime,
          survival: survivalProb,
          alive: alive - (deaths + censored)
        });
      }
    });
    
    setSurvivalData(survivalPoints);
  }, [rawData, startEventType, endEventType]);

  return (
    <div className="w-full p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Kaplan-Meier Survival Curve</h3>
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
                <option key={type} value={type}>
                  {type}
                </option>
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
              {endEventTypes.map(type => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="mb-4 p-2 bg-blue-50 border border-blue-200 rounded">
        Patients matching criteria: {patientCount}
        {patientCount === 0 && (
          <span className="ml-2 text-sm text-blue-600">
            (No patients found with selected event sequence)
          </span>
        )}
        {casecount > DATA_LIMIT && (
          <span className="ml-2 text-sm text-blue-600">
            (Using first {DATA_LIMIT} records)
          </span>
        )}
      </div>

      <div className="w-full h-[400px]">
        {survivalData.length > 0 ? (
          <LineChart
            width={800}
            height={400}
            data={survivalData}
            margin={{ top: 20, right: 30, left: 50, bottom: 50 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="time" 
              type="number"
              label={{ value: 'Time (days)', position: 'bottom' }} 
            />
            <YAxis 
              domain={[0, 1]} 
              label={{ value: 'Survival Probability', angle: -90, position: 'left' }} 
            />
            <Tooltip 
              formatter={(value) => [Number(value).toFixed(3), 'Survival Probability']}
            />
            <Legend />
            <Line 
              type="stepAfter"
              dataKey="survival" 
              stroke="#2196F3" 
              dot={false}
              name="Survival"
            />
          </LineChart>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500">
            {fetchingRef.current ? 'Loading...' : 'No data available for selected event types'}
          </div>
        )}
      </div>
    </div>
  );
};

export default FilteredSurvivalCurve;