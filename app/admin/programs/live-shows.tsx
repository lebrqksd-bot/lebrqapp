import ProgramDashboard from '@/components/admin/ProgramDashboard';
import React from 'react';

export default function LiveShowsDashboard() {
  return (
    <ProgramDashboard
      programType="live"
      title="Live Shows"
      subtitle="Concert, comedy, and event ticket holders"
      color="#1D4ED8"
      icon="radio-outline"
    />
  );
}
