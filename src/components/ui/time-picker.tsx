"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label"; // Optional, but good practice
import { cn } from "@/lib/utils"; // For combining class names
import { format, setHours, setMinutes, isValid } from 'date-fns'; // Use date-fns for formatting and setting time

interface TimePickerProps {
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  disabled?: boolean;
}

const TimePicker: React.FC<TimePickerProps> = ({ date, setDate, disabled = false }) => {

  const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const numValue = parseInt(value, 10);

    // If input is empty, clear the time if minutes are also empty/invalid
    if (value === '') {
        const currentMinute = date ? date.getMinutes() : NaN;
        if (isNaN(currentMinute)) { // If minutes are also not set
             setDate(undefined); // Clear the whole date
        } else {
             // If only hour is cleared, set hour to 0 but keep minutes
             const newDate = date ? new Date(date) : new Date();
             newDate.setHours(0);
             setDate(newDate);
        }
        return; // Stop here if input is empty
    }

    // If input is not empty and is a valid number (0-23)
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 23) {
      const newDate = date ? new Date(date) : new Date(); // Create a new Date object based on current date or now
      newDate.setHours(numValue);
      // If minutes were not set, set them to 0
      if (isNaN(newDate.getMinutes())) {
          newDate.setMinutes(0);
      }
      setDate(newDate); // Update the parent state
    }
    // If input is not empty but invalid number, do nothing (don't update state)
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const numValue = parseInt(value, 10);

     // If input is empty, clear the time if hours are also empty/invalid
    if (value === '') {
        const currentHour = date ? date.getHours() : NaN;
        if (isNaN(currentHour)) { // If hours are also not set
             setDate(undefined); // Clear the whole date
        } else {
             // If only minute is cleared, set minute to 0 but keep hours
             const newDate = date ? new Date(date) : new Date();
             newDate.setMinutes(0);
             setDate(newDate);
        }
        return; // Stop here if input is empty
    }

    // If input is not empty and is a valid number (0-59)
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 59) {
      const newDate = date ? new Date(date) : new Date(); // Create a new Date object based on current date or now
      // If hours were not set, set them to 0
      if (isNaN(newDate.getHours())) {
          newDate.setHours(0);
      }
      newDate.setMinutes(numValue);
      setDate(newDate); // Update the parent state
    }
     // If input is not empty but invalid number, do nothing (don't update state)
  };

  // Format the date prop for display in inputs
  const displayHour = date && isValid(date) ? format(date, 'HH') : '';
  const displayMinute = date && isValid(date) ? format(date, 'mm') : '';


  return (
    <div className={cn("flex items-center gap-2", disabled && "opacity-50 cursor-not-allowed")}>
      {/* Optional Label */}
      {/* <Label htmlFor="hour-input" className="sr-only">Hora</Label> */}
      <Input
        id="hour-input"
        type="number"
        placeholder="HH"
        value={displayHour} // Use formatted date prop directly
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
        value={displayMinute} // Use formatted date prop directly
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