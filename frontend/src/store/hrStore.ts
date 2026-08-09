import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Job, Application, Interview, Offer, HRStats, ApplicationStatus, JobStatus, InterviewStatus, JobType, WorkMode } from '@/types/hr';
import { careersService } from '@/services/moduleServices';
import { userManagementService } from '@/services/crmService';

// Backend stores free-text status columns ("open"/"submitted"/"interviewing"/…)
// with no enum, while the UI (StatusChip, filters) is built around the fixed
// Capitalized vocabulary below - map one to the other at the fetch boundary
// rather than changing the DB/API contract.
function mapJobStatus(status: string): JobStatus {
  const s = (status || '').toLowerCase();
  if (s === 'closed') return 'Closed';
  if (s === 'draft') return 'Draft';
  return 'Published';
}

function mapApplicationStatus(status: string): ApplicationStatus {
  const s = (status || '').toLowerCase();
  const known: Record<string, ApplicationStatus> = {
    submitted: 'New',
    new: 'New',
    screening: 'Screening',
    shortlisted: 'Shortlisted',
    interviewing: 'Interviewing',
    completed: 'Interviewing',
    offered: 'Offered',
    hired: 'Hired',
    rejected: 'Rejected',
  };
  return known[s] ?? 'New';
}

type ApiRecord = Record<string, unknown>;

function mapJobRead(raw: ApiRecord, departmentNameById: Record<string, string>): Job {
  const departmentId = raw.department_id as string | null | undefined;
  const employmentType = raw.employment_type as string | undefined;
  return {
    id: raw.id as string,
    title: raw.title as string,
    department: (departmentId && departmentNameById[departmentId]) || 'Unassigned',
    serviceCategory: (raw.service_category as string) || '',
    employmentType: (employmentType?.replaceAll('_', '-') || 'Full-time') as JobType,
    experienceLevel: (raw.experience_level as string) || '',
    location: (raw.location as string) || '',
    workMode: ((raw.work_mode as string) || 'On-site') as WorkMode,
    salaryRange: (raw.salary_range as string) || '',
    vacancies: (raw.vacancies as number) ?? 1,
    skillsRequired: (raw.skills_required as string[]) || [],
    responsibilities: (raw.responsibilities as string[]) || [],
    requirements: raw.requirements ? [raw.requirements as string] : [],
    benefits: (raw.benefits as string[]) || [],
    description: (raw.description as string) || '',
    applicationDeadline: (raw.application_deadline as string) || '',
    status: mapJobStatus(raw.status as string),
    postedDate: (raw.posted_at as string) || (raw.created_at as string) || '',
  };
}

// `experience` has no backing column anywhere in the Careers module (only
// education/work_history are captured) - left blank rather than fabricated.
function mapApplicationRead(raw: ApiRecord, jobsById: Record<string, Job>): Application {
  const jobOpeningId = raw.job_opening_id as string;
  const job = jobsById[jobOpeningId];
  return {
    id: raw.id as string,
    jobId: jobOpeningId,
    jobTitle: job?.title || 'Unknown Position',
    department: job?.department || 'Unassigned',
    location: job?.location || '',
    candidateName: raw.applicant_name as string,
    email: raw.applicant_email as string,
    phone: (raw.applicant_phone as string) || '',
    experience: '',
    skills: (raw.skills as string[]) || [],
    resumeUrl: (raw.resume_url as string) || undefined,
    portfolioUrl: (raw.portfolio_url as string) || undefined,
    coverLetter: (raw.cover_letter as string) || undefined,
    education: (raw.education as Application['education']) || [],
    workHistory: (raw.work_history as Application['workHistory']) || [],
    appliedDate: raw.created_at as string,
    status: mapApplicationStatus(raw.status as string),
    notes: (raw.notes as string) || '',
  };
}

interface HrState {
  jobs: Job[];
  applications: Application[];
  interviews: Interview[];
  offers: Offer[];
  departments: { id: string; name: string }[];
  isLoading: boolean;
  dataLoaded: boolean;

  // API Actions
  fetchAllData: () => Promise<void>;
  fetchJobs: () => Promise<void>;
  fetchDepartments: () => Promise<void>;
  fetchApplications: (jobId?: string) => Promise<void>;

  // Actions
  addJob: (job: Job) => void;
  updateJob: (id: string, updates: Partial<Job>) => void;
  deleteJob: (id: string) => void;
  
  addApplication: (app: Application) => void;
  updateApplicationStatus: (id: string, status: ApplicationStatus) => void;
  
  addInterview: (interview: Interview) => void;
  updateInterviewStatus: (id: string, status: InterviewStatus) => void;
  addOffer: (offer: Offer) => void;
}

export const useHrStore = create<HrState>()(
  persist(
    (set, get) => ({
      jobs: [],
      applications: [],
      interviews: [],
      offers: [],
      departments: [],
      isLoading: false,
      dataLoaded: false,

      // ─── API FETCH ACTIONS ────────────────────────────────────────────────
      fetchAllData: async () => {
        set({ isLoading: true });
        try {
          await get().fetchDepartments();
          await get().fetchJobs();
          await get().fetchApplications();
          set({ isLoading: false, dataLoaded: true });
        } catch {
          set({ isLoading: false });
        }
      },

      fetchDepartments: async () => {
        try {
          const res = await userManagementService.getDepartments({ page_size: 200 });
          const items: ApiRecord[] = res.items || res || [];
          set({ departments: items.map((d) => ({ id: d.id as string, name: d.name as string })) });
        } catch { /* keep existing */ }
      },

      fetchJobs: async () => {
        try {
          const res = await careersService.getJobs({ page_size: 100 });
          const items: ApiRecord[] = res.items || res || [];
          const departmentNameById = Object.fromEntries(get().departments.map((d) => [d.id, d.name]));
          set({ jobs: items.map((raw) => mapJobRead(raw, departmentNameById)) });
        } catch { /* keep existing */ }
      },

      fetchApplications: async (jobId?: string) => {
        try {
          const res = jobId
            ? await careersService.getApplications(jobId, { page_size: 100 })
            : await careersService.getAllApplications({ page_size: 200 });
          const items: ApiRecord[] = res.items || res || [];
          const jobsById = Object.fromEntries(get().jobs.map((j) => [j.id, j]));
          set({ applications: items.map((raw) => mapApplicationRead(raw, jobsById)) });
        } catch { /* keep existing */ }
      },

      addJob: (job) => set((state) => ({ jobs: [job, ...state.jobs] })),
      
      updateJob: (id, updates) => set((state) => ({
        jobs: state.jobs.map((j) => (j.id === id ? { ...j, ...updates } : j)),
      })),
      
      deleteJob: (id) => set((state) => ({
        jobs: state.jobs.filter((j) => j.id !== id),
      })),
      
      addApplication: (app) => set((state) => ({ applications: [app, ...state.applications] })),
      
      updateApplicationStatus: (id, status) => set((state) => ({
        applications: state.applications.map((app) => (app.id === id ? { ...app, status } : app)),
      })),
      
      addInterview: (interview) => set((state) => ({ interviews: [interview, ...state.interviews] })),
      
      updateInterviewStatus: (id, status) => set((state) => ({
        interviews: state.interviews.map((int) => (int.id === id ? { ...int, status } : int)),
      })),
      
      addOffer: (offer) => set((state) => ({ offers: [offer, ...state.offers] })),
    }),
    {
      name: 'amplivo-hr-storage',
      partialize: () => ({}),
    }
  )
);

export const useHrStats = (): HRStats => {
  const jobs = useHrStore(state => state.jobs);
  const applications = useHrStore(state => state.applications);
  const interviews = useHrStore(state => state.interviews);
  const offers = useHrStore(state => state.offers);

  return useMemo(() => {
    return {
      totalOpenPositions: jobs.filter(j => j.status === 'Published').reduce((acc, curr) => acc + curr.vacancies, 0),
      activeJobs: jobs.filter(j => j.status === 'Published').length,
      closedJobs: jobs.filter(j => j.status === 'Closed').length,
      totalApplications: applications.length,
      newApplications: applications.filter(a => a.status === 'New').length,
      shortlistedCandidates: applications.filter(a => a.status === 'Shortlisted' || a.status === 'Interviewing' || a.status === 'Offered' || a.status === 'Hired').length,
      interviewsToday: interviews.filter(i => i.date === new Date().toISOString().split('T')[0]).length,
      pendingInterviews: interviews.filter(i => i.status === 'Scheduled').length,
      hiredCandidates: applications.filter(a => a.status === 'Hired').length,
      rejectedCandidates: applications.filter(a => a.status === 'Rejected').length,
      offerLettersSent: offers.filter(o => o.status === 'Sent' || o.status === 'Accepted').length,
    };
  }, [jobs, applications, interviews, offers]);
};
