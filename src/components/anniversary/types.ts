export interface SpecialDate {
  id: string;
  calendarId: string;
  title: string;
  date: string;
  description: string;
  countType: 'years' | 'months' | 'yearsAndMonths';
  repeatCount: number;
}

export interface RegisterFormProps {
  calendarId: string;
  title: string;
  date: string;
  description: string;
  countType: 'years' | 'months' | 'yearsAndMonths';
  repeatCount: number;
  isLoading: boolean;
  onCalendarIdChange: (value: string) => void;
  onTitleChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onCountTypeChange: (value: 'years' | 'months' | 'yearsAndMonths') => void;
  onRepeatCountChange: (value: number) => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  onSwitchToDeleteMode: () => void;
}

export interface DeleteFormProps {
  deleteCalendarId: string;
  isLoading: boolean;
  onDeleteCalendarIdChange: (value: string) => void;
  onDeleteConfirmationOpen: () => void;
  onSwitchToRegisterMode: () => void;
}

export interface DeleteConfirmationModalProps {
  deleteCalendarId: string;
  isLoading: boolean;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}