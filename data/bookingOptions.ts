// @/data/bookingOptions.ts

export const bodyPlacements = [
    { value: 'arm_upper', label: 'Upper Arm' },
    { value: 'arm_lower', label: 'Forearm / Lower Arm' },
    { value: 'hand', label: 'Hand' },
    { value: 'leg_upper', label: 'Thigh / Upper Leg' },
    { value: 'leg_lower', label: 'Calf / Lower Leg' },
    { value: 'foot', label: 'Foot' },
    { value: 'chest', label: 'Chest' },
    { value: 'stomach', label: 'Stomach' },
    { value: 'back_upper', label: 'Upper Back' },
    { value: 'back_lower', label: 'Lower Back' },
    { value: 'neck', label: 'Neck' },
    { value: 'head', label: 'Head' },
    { value: 'other', label: 'Other' },
] as const;
