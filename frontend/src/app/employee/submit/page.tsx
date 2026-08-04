'use client';

import { use, useState, useEffect, useRef } from 'react';
import { isAxiosError } from 'axios';
import { useCrmStore } from '@/store/crmStore';
import { taskSubmissionService, taskService } from '@/services/crmService';
import { fileManagerService } from '@/services/moduleServices';
import { useToastStore } from '@/store/toastStore';
import { EmployeeHeader } from '@/components/employee/EmployeeHeader';
import { UploadCloud, FileText, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

function extractErrorMessage(err: unknown): string {
  if (isAxiosError<{ message?: string; detail?: string; details?: { msg: string }[] }>(err)) {
    const data = err.response?.data;
    if (data?.details?.length) return data.details.map(d => d.msg).join(' ');
    return data?.message || data?.detail || 'Something went wrong. Please try again.';
  }
  return 'Something went wrong. Please try again.';
}

// Maps a failed file-upload request to a concrete, actionable message instead
// of a raw Axios/network error string.
function extractUploadErrorMessage(err: unknown): string {
  if (isAxiosError<{ message?: string; detail?: string }>(err)) {
    if (!err.response) {
      return 'Server unavailable. Please check your connection and try again.';
    }
    const status = err.response.status;
    const serverMessage = err.response.data?.message || err.response.data?.detail;
    if (status === 401 || status === 403) return 'Permission denied. You do not have access to upload this file.';
    if (status === 404) return 'Upload failed. The destination folder could not be found.';
    if (status === 413) return 'Invalid file. The file is too large to upload.';
    if (status === 415) return 'Unsupported file. Please choose a different file type.';
    if (status === 400 || status === 422) return serverMessage || 'Invalid file. Please check the file and try again.';
    if (status >= 500) return 'Server unavailable. Please try again shortly.';
    return serverMessage || 'Upload failed. Please try again.';
  }
  return 'Upload failed. Please try again.';
}

// Deliverables are expected to live on one of these platforms - anything
// else is rejected up front instead of being silently accepted and only
// failing (or worse, half-working) once a CRM reviewer opens the link.
const ALLOWED_URL_HOSTS = ['github.com', 'drive.google.com', 'docs.google.com', 'figma.com', 'onedrive.live.com', '1drv.ms', 'dropbox.com'];

function validateExternalUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null; // blank is allowed

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return 'Please enter a valid URL (or leave it blank).';
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return 'Please enter a valid URL (or leave it blank).';
  }
  const host = parsed.hostname.toLowerCase();
  const allowed = ALLOWED_URL_HOSTS.some(h => host === h || host.endsWith(`.${h}`)) || host.endsWith('.sharepoint.com');
  if (!allowed) {
    return 'External URL must link to GitHub, Google Drive, Figma, OneDrive, or Dropbox.';
  }
  return null;
}

interface TaskSubmissionHistoryItem {
  id: string;
  title: string;
  status: string;
  completion_percentage: number;
  version_number: number;
  created_at: string;
}

export default function EmployeeSubmitWork({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const resolvedParams = use(searchParams);
  const taskId = resolvedParams.taskId as string | undefined;
  const projectId = resolvedParams.projectId as string | undefined;
  const subId = resolvedParams.id as string | undefined;

  const { activeEmployeeId, getTasksByEmployee, submissions, submitToCRM, resubmitToCRM, fetchAllData, dataLoaded } = useCrmStore();

  const existingSub = subId ? submissions.find(s => s.id === subId) : undefined;
  const isRevision = !!existingSub;

  const tasks = getTasksByEmployee(activeEmployeeId || '');
  const [selectedTaskId, setSelectedTaskId] = useState(taskId || (existingSub?.taskId) || '');
  const [taskSubmissions, setTaskSubmissions] = useState<TaskSubmissionHistoryItem[]>([]);

  const selectedTask = tasks.find(t => t.id === selectedTaskId);

  const [title, setTitle] = useState(existingSub?.title || '');
  const [workSummary, setWorkSummary] = useState(existingSub?.workSummary || '');
  const [deliverableType, setDeliverableType] = useState(existingSub?.deliverableType || 'Document');
  const [url, setUrl] = useState(existingSub?.versions[0]?.externalUrl || '');
  const [employeeComment, setEmployeeComment] = useState('');
  const [completionPercentage, setCompletionPercentage] = useState(existingSub?.versions[0]?.completionPercentage ?? 100);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (existingSub) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTitle(existingSub.title);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWorkSummary(existingSub.workSummary);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDeliverableType(existingSub.deliverableType);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUrl(existingSub.versions[0]?.externalUrl || '');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCompletionPercentage(existingSub.versions[0]?.completionPercentage ?? 100);
    }
  }, [existingSub]);

  // Submission history for the currently-selected task - fetched from the
  // real backend, never from local/mock state.
  useEffect(() => {
    if (!selectedTaskId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTaskSubmissions([]);
      return;
    }
    let cancelled = false;
    taskSubmissionService.getAll(selectedTaskId)
      .then((data) => { if (!cancelled) setTaskSubmissions(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setTaskSubmissions([]); });
    return () => { cancelled = true; };
  }, [selectedTaskId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || isSubmitting) return;

    setSubmitError(null);

    if (!title.trim()) {
      setSubmitError('Submission title is required.');
      return;
    }
    const urlError = validateExternalUrl(url);
    if (urlError) {
      setSubmitError(urlError);
      return;
    }

    setIsSubmitting(true);
    try {
      if (isRevision && existingSub) {
        await resubmitToCRM(existingSub.id, {
          externalUrl: url,
          completionPercentage,
          employeeComment,
          revisionNotes: employeeComment
        });
      } else {
        await submitToCRM({
          employeeId: activeEmployeeId!,
          projectId: selectedTask.projectId,
          taskId: selectedTask.id,
          clientId: selectedTask.clientId,
          service: selectedTask.service,
          assignedRole: selectedTask.assignedRole,
          title,
          workSummary,
          deliverableType,
          versions: [{
            versionId: '', versionNumber: 1, submissionDate: '', files: [], status: 'PENDING_CRM_REVIEW', completionPercentage,
            externalUrl: url, employeeComment
          }]
        });
      }

      // Handle file upload and attachment if a file was selected
      if (selectedFile) {
        try {
          const uploaded = await fileManagerService.uploadBinary(selectedFile);
          const apiOrigin = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1').replace(/\/api\/v1\/?$/, '');
          const fileUrl = uploaded.url.startsWith('http') ? uploaded.url : `${apiOrigin}${uploaded.url}`;
          await taskService.addAttachment(selectedTask.id, {
            file_name: uploaded.original_name || selectedFile.name,
            file_url: fileUrl,
            file_size: selectedFile.size,
          });
        } catch (uploadErr) {
          console.error("Failed to upload/attach file:", uploadErr);
          useToastStore.getState().showToast(`Submission succeeded, but ${extractUploadErrorMessage(uploadErr).toLowerCase()}`, 'error');
        }
      }

      setSubmitted(true);
      useToastStore.getState().showToast(isRevision ? 'Revision submitted successfully!' : 'Work submitted successfully!', 'success');
      // Pull the real, backend-computed task status/progress (the backend
      // sets status='submitted' and progress=completion_percentage) so the
      // Employee Dashboard reflects the submission immediately instead of
      // waiting for the next unrelated navigation to refetch. skipFinance:
      // true - see employee/layout.tsx for why.
      fetchAllData({ skipFinance: true });
    } catch (err) {
      setSubmitError(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col min-h-full">
        <EmployeeHeader title={isRevision ? "Revision Submitted" : "Work Submitted"} />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
            <CheckCircle size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Success!</h2>
          <p className="text-slate-500 mb-6 max-w-md">
            Your {isRevision ? 'revision' : 'work'} has been submitted to the CRM. The account manager will review it shortly.
          </p>
          <div className="flex gap-4">
            <Link href="/employee" className="px-6 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200">
              Back to Dashboard
            </Link>
            <Link href="/employee/projects" className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700">
              View My Projects
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!dataLoaded) {
    return (
      <div className="flex flex-col min-h-full">
        <EmployeeHeader title="Submit Work" subtitle="Send your deliverables for CRM review" />
        <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">Loading your tasks…</div>
      </div>
    );
  }

  const latestVersion = existingSub?.versions[0];

  return (
    <div className="flex flex-col min-h-full">
      <EmployeeHeader title={isRevision ? "Resubmit Revision" : "Submit Work"} subtitle="Send your deliverables for CRM review" />
      
      <div className="p-6 max-w-3xl mx-auto w-full">
        
        {/* BUG-9 Fix: Render "Back to Tasks" link ONLY if navigated from a task context (taskId present) */}
        {taskId && (
          <Link href="/employee/tasks" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 transition-colors mb-6">
            <ArrowLeft size={16} /> Back to Tasks
          </Link>
        )}
        
        {existingSub && existingSub.currentStatus === 'CRM_CHANGES_REQUESTED' && (
          <div className="mb-6 bg-red-50 p-5 rounded-xl border border-red-200">
            <h3 className="text-red-800 font-bold mb-2 flex items-center gap-2">
              <AlertCircle size={18} /> CRM Feedback
            </h3>
            <p className="text-red-700 text-sm whitespace-pre-wrap">{latestVersion?.crmFeedback || 'Changes requested by CRM.'}</p>
          </div>
        )}

        {!isRevision && tasks.length === 0 && (
          <div className="mb-6 bg-amber-50 p-5 rounded-xl border border-amber-200">
            <h3 className="text-amber-800 font-bold mb-1 flex items-center gap-2">
              <AlertCircle size={18} /> No Tasks Assigned
            </h3>
            <p className="text-amber-700 text-sm">You have no tasks assigned yet, so there is nothing to submit work against.</p>
          </div>
        )}

        {submitError && (
          <div className="mb-6 bg-red-50 p-4 rounded-xl border border-red-200 flex items-start gap-2">
            <AlertCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
            <p className="text-red-700 text-sm">{submitError}</p>
          </div>
        )}

        {taskSubmissions.length > 0 && (
          <div className="mb-6 bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Submission History</h3>
            <div className="space-y-3">
              {taskSubmissions.map(s => (
                <div key={s.id} className="flex items-center justify-between text-sm border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                  <div>
                    <div className="font-medium text-slate-800">{s.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      v{s.version_number} • {s.completion_percentage}% complete • {new Date(s.created_at).toLocaleString()}
                    </div>
                  </div>
                  <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full ${
                    s.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                    s.status === 'changes_requested' ? 'bg-red-100 text-red-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {s.status.replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
          
          {/* BUG-41 Fix: Visual required indicator (*) for Select Task */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Select Task <span className="text-red-500">*</span>
            </label>
            <select 
              value={selectedTaskId}
              onChange={(e) => setSelectedTaskId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
              aria-required="true"
              disabled={isRevision || tasks.length === 0}
            >
              <option value="">-- Select a task --</option>
              {tasks.map(t => (
                <option key={t.id} value={t.id}>{t.title} ({t.projectName})</option>
              ))}
            </select>
          </div>
          
          {/* BUG-41 Fix: Visual required indicator (*) for Submission Title */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Submission Title <span className="text-red-500">*</span>
            </label>
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
              aria-required="true"
              disabled={isRevision}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Deliverable Type</label>
            <select 
              value={deliverableType}
              onChange={(e) => setDeliverableType(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={isRevision}
            >
              <option>Document</option>
              <option>Spreadsheet</option>
              <option>Design Asset</option>
              <option>Code / PR</option>
              <option>External Link</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">External URL (Optional)</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://docs.google.com/..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Completion % <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={completionPercentage}
              onChange={(e) => setCompletionPercentage(Math.min(100, Math.max(0, Number(e.target.value))))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">File Upload (Optional)</label>
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 rounded-lg p-6 flex flex-col items-center justify-center text-slate-500 bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors"
            >
              <UploadCloud size={24} className="mb-2 text-indigo-500" />
              {selectedFile ? (
                <>
                  <div className="text-sm font-medium text-slate-700">{selectedFile.name}</div>
                  <div className="text-xs mt-1">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</div>
                </>
              ) : (
                <>
                  <div className="text-sm">Click to upload or drag and drop</div>
                  <div className="text-xs mt-1">PDF, DOCX, ZIP up to 50MB</div>
                </>
              )}
            </div>
          </div>

          {/* BUG-41 Fix: Visual required indicator (*) for Work Summary */}
          {!isRevision && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Work Summary <span className="text-red-500">*</span>
              </label>
              <textarea 
                value={workSummary}
                onChange={(e) => setWorkSummary(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
                aria-required="true"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{isRevision ? "Revision Notes" : "Comments for CRM (Optional)"}</label>
            <textarea 
              value={employeeComment}
              onChange={(e) => setEmployeeComment(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder={isRevision ? "Explain what was changed..." : "Any additional notes..."}
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
            <Link href="/employee/tasks" className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting || !selectedTask}
              className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <UploadCloud size={16} /> {isSubmitting ? 'Submitting...' : isRevision ? "Resubmit to CRM" : "Submit to CRM"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
