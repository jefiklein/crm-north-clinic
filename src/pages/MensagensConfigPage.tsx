import React, { useState, useEffect, useMemo, useRef } from 'react';
// ... (imports unchanged)

const MensagensConfigPage: React.FC<MensagensConfigPageProps> = ({ clinicData }) => {
  // ... (other state and hooks unchanged)

  // NEW EFFECT: Populate selectedServiceIds state when linkedServicesList loads (Edit mode)
  useEffect(() => {
    if (isEditing && linkedServicesList !== undefined) {
      const ids = linkedServicesList?.map(item => item.id_servico) || [];

      // Only update state if different from current selectedServiceIds to avoid infinite loop
      const areArraysEqual = (a: number[], b: number[]) => {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
          if (a[i] !== b[i]) return false;
        }
        return true;
      };

      setSelectedServiceIds(prevIds => {
        if (areArraysEqual(prevIds, ids)) {
          return prevIds; // No change, avoid state update
        }
        return ids;
      });
    } else if (!isEditing) {
      setSelectedServiceIds([]);
    }
  }, [linkedServicesList, isEditing]);

  // ... (rest of component unchanged)
};

export default MensagensConfigPage;