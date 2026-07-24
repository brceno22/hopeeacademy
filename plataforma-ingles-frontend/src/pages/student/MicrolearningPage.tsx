import React from 'react';
import { MicrolearningWidget } from '@/features/microlearning/components/MicrolearningWidget';
import '@/features/microlearning/styles/microlearning.css';

export const MicrolearningPage: React.FC = () => (
  <div className="ml-page fade-in-page">
    <h1>Daily Microlearning</h1>
    <p className="ml-page__intro">
      A short bite each day to keep your streak going. Check the level, estimated time, and complete
      it when you&apos;re ready.
    </p>
    <MicrolearningWidget />
  </div>
);
