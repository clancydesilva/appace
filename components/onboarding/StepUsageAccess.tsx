import React from 'react';
import { UsageAccessDisclosure } from '../UsageAccessDisclosure';

interface Props {
  onNext: () => void;
}

export function StepUsageAccess({ onNext }: Props) {
  return (
    <UsageAccessDisclosure
      showStatus
      onSkip={onNext}
    />
  );
}
