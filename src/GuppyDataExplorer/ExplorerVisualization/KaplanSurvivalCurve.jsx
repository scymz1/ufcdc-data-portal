import React, { useEffect, useState, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

const SurvivalCurve = ({ fetchAndUpdateRawData, casecount }) => {
  const [survivalData, setSurvivalData] = useState([]);

  const processData = useCallback((rawData) => {
    console.log('Processing raw data:', rawData);
    
    const patientLastFollowup = new Map();
    
    rawData.data.forEach(record => {
      const patId = record.pat_id[0];
      const currentTime = record.days_to_follow_up;
      
      if (!patientLastFollowup.has(patId) || 
          patientLastFollowup.get(patId).time < currentTime) {
        patientLastFollowup.set(patId, {
          time: currentTime,
          event: record.event_type === 'Dead',
          patId: patId
        });
      }
    });
    
    const patients = Array.from(patientLastFollowup.values());
    console.log('Total unique patients:', patients.length);
    console.log('Sample patient data:', patients[0]);
    
    const validPatients = patients.filter(p => 
      p.time != null && !isNaN(p.time)
    );
    console.log('Valid patients after filtering:', validPatients.length);
    
    validPatients.sort((a, b) => a.time - b.time);
    
    // Calculate the survive rate
    let alive = validPatients.length;
    let survivalProb = 1.0;
    const survivalPoints = [{
      time: 0,
      survival: 1.0,
      alive: alive
    }];
    
    let currentTime = 0;
    let deaths = 0;
    
    validPatients.forEach((patient, index) => {
      if (patient.time !== currentTime) {
        if (deaths > 0) {
          survivalProb *= (alive - deaths) / alive;
          alive -= deaths;
          survivalPoints.push({
            time: currentTime,
            survival: survivalProb,
            alive: alive
          });
          deaths = 0;
        }
        currentTime = patient.time;
      }
      
      if (patient.event) {
        deaths++;
      }
      
      // last point
      if (index === validPatients.length - 1 && deaths > 0) {
        survivalProb *= (alive - deaths) / alive;
        survivalPoints.push({
          time: currentTime,
          survival: survivalProb,
          alive: alive - deaths
        });
      }
    });
    
    console.log('Survival points:', survivalPoints);
    return survivalPoints;
  }, []);

  useEffect(() => {
    if (casecount > 0) {
      console.log('Fetching data with casecount:', casecount);
      fetchAndUpdateRawData({
        offset: 0,
        size: casecount,
        sort: []
      }).then((res) => {
        const processedData = processData(res);
        if (processedData && processedData.length > 0) {
          console.log('Setting survival data:', processedData);
          setSurvivalData(processedData);
        } else {
          console.warn('No valid survival data to display');
        }
      }).catch(error => {
        console.error('Error:', error);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [casecount]);

  return (
    <div className="w-full p-4">
      <h3 className="text-lg font-semibold mb-4">Kaplan-Meier Survival Curve</h3>
      <div className="w-full h-[400px]">
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
      </div>
    </div>
  );
};

export default SurvivalCurve;