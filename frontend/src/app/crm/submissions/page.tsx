'use client';

import React, { useMemo, useState } from 'react';
import {
  Search, ClipboardCheck, CheckCircle, Clock, AlertCircle, ExternalLink,
} from 'lucide-react';
import { useCrmStore } from '@/store/crmStore';
import { useToastStore } from '@/store/toastStore';
import type { SubmissionStatus } from '@/types/crm';

const STATUS_TABS: { label: string; value: SubmissionStatus | 'All' }[] = [
  { label: 'All', value: 'All' },
  { label: 'Pending Review', value: 'PENDING_CRM_REVIEW' },
  { label: 'Changes Requested', value: 'CRM_CHANGES_REQUESTED' },
  { label: 'Approved', value: 'CRM_APPROVED' },
];

export default function CrmSubmissionsPage() {
  const { submissions, tasks, employees, getProjectById, approveSubmission, requestSubmissionChanges } = useCrmStore();
  const showToast = useToastStore((s) => s.showToast);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus | 'All'>('PENDING_CRM_REVIEW');
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleApprove = async (submissionId: string) => {
    setBusyId(submissionId);
    try {
      await approveSubmission(submissionId);
      showToast('Submission approved.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to approve submission.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleRequestChanges = async (submissionId: string) => {
    const feedback = window.prompt('Describe what needs to change before this can be approved:');
    if (!feedback || !feedback.trim()) return;
    setBusyId(submissionId);
    try {
      await requestSubmissionChanges(submissionId, feedback.trim());
      showToast('Changes requested — the employee has been notified.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to request changes.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const filtered = useMemo(() => {
    return submissions
      .filter(s => {
        const task = tasks.find(t => t.id === s.taskId);
        const project = getProjectById(s.projectId);
        const employee = employees.find(e => e.id === s.employeeId);
        const q = search.toLowerCase();
        const matchSearch = !q
          || s.title.toLowerCase().includes(q)
          || (task?.title.toLowerCase().includes(q) ?? false)
          || (project?.name.toLowerCase().includes(q) ?? false)
          || (employee?.name?.toLowerCase().includes(q) ?? false);
        const matchStatus = statusFilter === 'All' || s.currentStatus === statusFilter;
        return matchSearch && matchStatus;
      })
      .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
  }, [submissions, tasks, employees, getProjectById, search, statusFilter]);

  const pendingCount = submissions.filter(s => s.currentStatus === 'PENDING_CRM_REVIEW').length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Submissions</h1>
          <p className="text-sm text-slate-500 mt-0.5">Review work submitted by Account Managers before it goes back to the client</p>
        </div>
        {pendingCount > 0 && (
          <span className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5" /> {pendingCount} awaiting review
          </span>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex gap-2 bg-[#12141f] p-1 rounded-lg border border-white/5 overflow-x-auto scrollbar-hide">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`shrink-0 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                statusFilter === tab.value
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by title, task, project, or employee..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#12141f] border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 transition-colors"
          />
        </div>
      </div>

      <div className="bg-[#12141f] border border-white/5 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <ClipboardCheck className="w-8 h-8 mb-3 text-slate-600" />
            <p>No submissions found.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filtered.map(sub => {
              const task = tasks.find(t => t.id === sub.taskId);
              const project = getProjectById(sub.projectId);
              const employee = employees.find(e => e.id === sub.employeeId);
              const latest = sub.versions[0];
              const isPending = sub.currentStatus === 'PENDING_CRM_REVIEW';

              return (
                <div key={sub.id} className="p-5 hover:bg-white/[0.02] transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-white">{sub.title}</h3>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                          sub.currentStatus === 'CRM_APPROVED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          sub.currentStatus === 'CRM_CHANGES_REQUESTED' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                          'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {sub.currentStatus.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {employee?.name || 'Unknown employee'} · {task?.title || 'Unknown task'} · {project?.name || 'Unknown project'} · v{latest?.versionNumber ?? 1}
                      </p>
                      {sub.workSummary && (
                        <p className="text-sm text-slate-300 mt-2 whitespace-pre-wrap">{sub.workSummary}</p>
                      )}
                      {latest?.employeeComment && latest.employeeComment !== sub.workSummary && (
                        <p className="text-sm text-slate-400 mt-1 italic whitespace-pre-wrap">&ldquo;{latest.employeeComment}&rdquo;</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                        <span>{latest?.completionPercentage ?? 100}% complete</span>
                        {latest?.externalUrl && (
                          <a href={latest.externalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-violet-400 hover:text-violet-300">
                            View deliverable <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      {sub.currentStatus === 'CRM_CHANGES_REQUESTED' && latest?.crmFeedback && (
                        <div className="mt-3 bg-red-500/5 border border-red-500/20 rounded-lg p-3 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                          <p className="text-xs text-red-300">{latest.crmFeedback}</p>
                        </div>
                      )}
                    </div>

                    {isPending && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleApprove(sub.id)}
                          disabled={busyId === sub.id}
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition-colors"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button
                          onClick={() => handleRequestChanges(sub.id)}
                          disabled={busyId === sub.id}
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-red-600/80 hover:bg-red-500 disabled:opacity-50 text-white transition-colors"
                        >
                          <AlertCircle className="w-3.5 h-3.5" /> Request Changes
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="px-5 py-3 border-t border-white/5 text-xs text-slate-500">
          Showing {filtered.length} of {submissions.length} submissions
        </div>
      </div>
    </div>
  );
}
