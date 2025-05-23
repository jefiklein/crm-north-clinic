"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label"; // Optional, but good practice
import { cn } from "@/lib/utils"; // For combining class names

interface TimePickerProps {
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  disabled?: boolean;
}

const TimePicker: React.FC<TimePickerProps> = ({ date, setDate, disabled = false }) => {
  const [hour, setHour] = React.useState<string>(date ? format(date, 'HH') : '');
  const [minute, setMinute] = React.useState<string>(date ? format(date, 'mm') : '');

  // Sync internal state with external date prop
  React.useEffect(() => {
    if (date) {
      setHour(format(date, 'HH'));
      setMinute(format(date, 'mm'));
    } else {
      setHour('');
      setMinute('');
    }
  }, [date]);

  const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setHour(value);
    const numValue = parseInt(value, 10);

    // Basic validation and update
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 23) {
      const newDate = date ? new Date(date) : new Date();
      newDate.setHours(numValue);
      // Keep existing minutes if available, otherwise set to 0
      if (minute === '') newDate.setMinutes(0);
      setDate(newDate);
    } else if (value === '') {
        // Allow clearing the input
        // If both hour and minute are cleared, set date to undefined
        if (minute === '') setDate(undefined);
        else {
             // If only hour is cleared, keep the date but maybe reset time?
             // For simplicity, let's just not update the date if hour is invalid/cleared alone
        }
    }
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setMinute(value);
    const numValue = parseInt(value, 10);

    // Basic validation and update
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 59) {
      const newDate = date ? new Date(date) : new Date();
      // Keep existing hours if available, otherwise set to 0
      if (hour === '') newDate.setHours(0);
      newDate.setMinutes(numValue);
      setDate(newDate);
    } else if (value === '') {
        // Allow clearing the input
         // If both hour and minute are cleared, set date to undefined
        if (hour === '') setDate(undefined);
         else {
             // If only minute is cleared, keep the date but maybe reset time?
             // For simplicity, let's just not update the date if minute is invalid/cleared alone
        }
    }
  };

   // Simple format function (can use date-fns if preferred, but keeping it simple here)
   const format = (d: Date, fmt: 'HH' | 'mm'): string => {
       const hours = d.getHours();
       const minutes = d.getMinutes();
       if (fmt === 'HH') return hours.toString().padStart(2, '0');
       if (fmt === 'mm') return minutes.toString().padStart(2, '0');
       return '';
   };


  return (
    <div className={cn("flex items-center gap-2", disabled && "opacity-50 cursor-not-allowed")}>
      {/* Optional Label */}
      {/* <Label htmlFor="hour-input" className="sr-only">Hora</Label> */}
      <Input
        id="hour-input"
        type="number"
        placeholder="HH"
        value={hour}
        onChange={handleHourChange}
        className="w-14 text-center"
        min="0"
        max="23"
        disabled={disabled}
        // Prevent scrolling changing value
        onWheel={(e) => (e.target as HTMLInputElement).blur()}
      />
      <span className="text-lg font-bold">:</span>
      {/* Optional Label */}
      {/* <Label htmlFor="minute-input" className="sr-only">Minuto</Label> */}
      <Input
        id="minute-input"
        type="number"
        placeholder="MM"
        value={minute}
        onChange={handleMinuteChange}
        className="w-14 text-center"
        min="0"
        max="59"
        disabled={disabled}
         // Prevent scrolling changing value
        onWheel={(e) => (e.target as HTMLInputElement).blur()}
      />
    </div>
  );
};

export { TimePicker };