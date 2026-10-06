import React from 'react';
import { Shield, AlertTriangle } from '../design/icons';
import './moments.css';

interface SystemNoticeToastProps {
  message: string;
  severity?: 'info' | 'warning';
}

export const SystemNoticeToast: React.FC<SystemNoticeToastProps> = ({
  message,
  severity = 'info',
}) => {
  return (
    <div
      className="live-moment-toast"
      role="alert"
      style={{
        borderColor: severity === 'warning' ? 'rgba(239, 68, 68, 0.6)' : 'rgba(99, 102, 241, 0.5)',
        background: severity === 'warning' ? 'rgba(69, 10, 10, 0.9)' : 'rgba(15, 23, 42, 0.9)',
      }}
    >
      {severity === 'warning' ? (
        <AlertTriangle size={16} color="#ef4444" />
      ) : (
        <Shield size={16} color="#818cf8" />
      )}
      <span style={{ fontSize: '12px', fontWeight: 600 }}>{message}</span>
    </div>
  );
};
