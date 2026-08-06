'use client';

import { useCrmStore } from '@/store/crmStore';
import { EmployeeHeader } from '@/components/employee/EmployeeHeader';
import { CheckSquare, Play, AlertOctagon, MessageSquare, UploadCloud, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function EmployeeTasks() {
  const { activeEmployeeId, getTasksByEmployee, startTask, updateTaskProgress, markTaskBlocked, dataLoaded } = useCrmStore();
  const tasks = getTasksByEmployee(activeEmployeeId || '');

  return (
    <div className="flex flex-col min-h-full">
      <EmployeeHeader title="My Tasks" subtitle="Your assigned work" />

      <div className="p-6 max-w-7xl mx-auto w-full space-y-6">
        {!dataLoaded && (
          <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500 text-sm">
            Loading your tasks…
          </div>
        )}
        {dataLoaded && tasks.length === 0 && (
          <div className="bg-white p-8 rounded-xl border border-slate-200 text-center">
            <CheckSquare className="mx-auto text-slate-300 mb-4" size={48} />
            <h3 className="text-lg font-bold text-slate-900 mb-1">No Tasks Assigned</h3>
            <p className="text-slate-500 text-sm">You don&apos;t have any tasks right now.</p>
          </div>
        )}
        {dataLoaded && tasks.length > 0 && (
          <div className="space-y-4">
            {tasks.map(task => (
              <div key={task.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col md:flex-row gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-bold px-2 py-1 bg-slate-100 text-slate-600 rounded-md">
                      {task.taskNumber}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                      task.status === 'DONE' ? 'bg-green-100 text-green-700' :
                      task.status === 'IN_PROGRESS' ? 'bg-indigo-100 text-indigo-700' :
                      task.status === 'BLOCKED' ? 'bg-red-100 text-red-700' :
                      task.status === 'SUBMITTED' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {task.status.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-slate-500 font-medium ml-auto">
                      Due: {task.dueDate}
                    </span>
                  </div>
                  <h3 className="font-bold text-lg text-slate-900 mb-1">{task.title}</h3>
                  <div className="text-sm text-slate-500 mb-4">{task.projectName} • {task.service}</div>
                  
                  <div className="mb-4">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500">Progress</span>
                      <span className="font-medium text-slate-900">{task.progress}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${task.progress}%` }} />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 w-full md:w-48 justify-center border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6">
                  {task.status === 'TODO' && (
                    <button onClick={() => startTask(task.id)} className="flex items-center justify-center gap-2 w-full py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100">
                      <Play size={16} /> Start Task
                    </button>
                  )}
                  {task.status === 'IN_PROGRESS' && (
                    <>
                      <button onClick={() => updateTaskProgress(task.id, Math.min(100, task.progress + 25))} className="flex items-center justify-center gap-2 w-full py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100">
                        Update Progress
                      </button>
                      <button onClick={() => markTaskBlocked(task.id, 'Need client assets')} className="flex items-center justify-center gap-2 w-full py-2 bg-red-50 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100">
                        <AlertOctagon size={16} /> Mark Blocked
                      </button>
                    </>
                  )}
                  <Link href={`/employee/submit?taskId=${task.id}&projectId=${task.projectId}`} className="flex items-center justify-center gap-2 w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
                    <UploadCloud size={16} /> Submit Work
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
