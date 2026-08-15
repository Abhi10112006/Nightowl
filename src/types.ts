/// <reference types="vite/client" />

export interface StudyTask {
  id: string;
  startTime: string;
  endTime: string;
  title: string;
  desc: string;
  priority: 'High' | 'Medium' | 'Low';
  studyHours?: number;
  googleListId?: string;
  isGoogleTask?: boolean;
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  colorId?: string;
}

export interface GoogleTask {
  id: string;
  title: string;
  status: string;
  notes?: string;
}

export interface GoogleTasksList {
  id: string;
  title: string;
}

export interface GoogleUserProfile {
  email?: string;
  name?: string;
  picture?: string;
}

declare global {
  interface Window {
    google: any;
  }
}
