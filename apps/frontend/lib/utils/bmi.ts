export type BmiCategoryId = 'underweight' | 'normal' | 'overweight' | 'obesity';

export type BmiAssessment = {
  bmi: number;
  categoryId: BmiCategoryId;
  label: string;
  colorVar: string;
  thresholds: {
    normalMin: number;
    overweightMin: number;
    obesityMin: number;
  };
  ageGroupLabel: string;
};

function getThresholdsByAge(age: number): {
  normalMin: number;
  overweightMin: number;
  obesityMin: number;
  ageGroupLabel: string;
} {
  if (age <= 14) {
    return {
      normalMin: 15.5,
      overweightMin: 22.0,
      obesityMin: 26.0,
      ageGroupLabel: '12–14 años',
    };
  }
  if (age <= 17) {
    return {
      normalMin: 17.0,
      overweightMin: 24.0,
      obesityMin: 28.0,
      ageGroupLabel: '15–17 años',
    };
  }
  if (age <= 19) {
    return {
      normalMin: 18.0,
      overweightMin: 25.0,
      obesityMin: 29.5,
      ageGroupLabel: '18–19 años',
    };
  }
  if (age >= 65) {
    return {
      normalMin: 22.0,
      overweightMin: 27.0,
      obesityMin: 30.0,
      ageGroupLabel: '65+ años',
    };
  }
  return {
    normalMin: 18.5,
    overweightMin: 25.0,
    obesityMin: 30.0,
    ageGroupLabel: '20–64 años',
  };
}

export function calculateAgeBasedBmi(
  weightKg: number,
  heightCm: number,
  age: number
): BmiAssessment {
  const heightM = Math.max(0.5, heightCm / 100);
  const bmi = Number((weightKg / (heightM * heightM)).toFixed(1));
  const { normalMin, overweightMin, obesityMin, ageGroupLabel } =
    getThresholdsByAge(age);

  if (bmi < normalMin) {
    return {
      bmi,
      categoryId: 'underweight',
      label: 'Bajo peso',
      colorVar: 'var(--status-info)',
      thresholds: { normalMin, overweightMin, obesityMin },
      ageGroupLabel,
    };
  }

  if (bmi < overweightMin) {
    return {
      bmi,
      categoryId: 'normal',
      label: 'Peso normal',
      colorVar: 'var(--status-success)',
      thresholds: { normalMin, overweightMin, obesityMin },
      ageGroupLabel,
    };
  }

  if (bmi < obesityMin) {
    return {
      bmi,
      categoryId: 'overweight',
      label: 'Sobrepeso',
      colorVar: 'var(--status-warning)',
      thresholds: { normalMin, overweightMin, obesityMin },
      ageGroupLabel,
    };
  }

  return {
    bmi,
    categoryId: 'obesity',
    label: 'Obesidad',
    colorVar: 'var(--status-danger)',
    thresholds: { normalMin, overweightMin, obesityMin },
    ageGroupLabel,
  };
}
