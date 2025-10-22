// @/data/bookingOptions.ts

export const tattooSizes = [
    { value: 'small', label: 'Small (Under 2 inches)' },
    { value: 'medium', label: 'Medium (Palm-sized)' },
    { value: 'large', label: 'Large (Hand-sized)' },
    { value: 'xl', label: 'Extra Large (Half-sleeve)' },
    { value: 'sleeve', label: 'Full Sleeve / Backpiece' }
] as const;

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

export const estimatedHours = [
    { value: 1, label: '1-2 Hours' },
    { value: 3, label: '3-4 Hours' },
    { value: 5, label: '5-6 Hours (Half Day)' },
    { value: 8, label: '8+ Hours (Full Day)' },
] as const;
