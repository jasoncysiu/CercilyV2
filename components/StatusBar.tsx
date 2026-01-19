'use client';

import { useState, useEffect } from 'react';
import { Signal, Moon } from 'lucide-react'; // Import Lucide icons

export default function StatusBar() {
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }));
      setDate(now.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' }));
    };
    updateDateTime();
    const interval = setInterval(updateDateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="status-bar">
      <div className="status-bar-left">
        <span>{time}</span>
        <span>{date}</span>
      </div>
      <div className="status-bar-right">
        <Signal size={16} />
        <Moon size={16} />
        <span>42%</span>
      </div>
    </div>
  );
}