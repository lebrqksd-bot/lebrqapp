import ProgramDashboard from '@/components/admin/ProgramDashboard';
import React from 'react';

export default function YogaDashboard() {
  return (
    <ProgramDashboard
      programType="yoga"
      title="Yoga Sessions"
      subtitle="Morning yoga class participants and schedules"
      color="#7C3AED"
      icon="body-outline"
    />
  );
}
