import { useState } from 'react';
import { Upload, FileText, CheckCircle } from 'lucide-react';

export function NewDischarge() {
  const [step, setStep] = useState(1);
  const [selectedPatient, setSelectedPatient] = useState('');

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">New Discharge</h1>
        <p className="text-sm text-slate-600 mt-0.5">
          Process a new patient discharge
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-4">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
              step >= s ? 'bg-primary text-white' : 'bg-surface-container text-slate-600'
            }`}>
              {step > s ? <CheckCircle className="w-4 h-4" /> : s}
            </div>
            <span className={`text-sm ${step >= s ? 'text-slate-900 font-medium' : 'text-slate-500'}`}>
              {s === 1 ? 'Upload' : s === 2 ? 'What we found' : 'Review & publish'}
            </span>
            {s < 3 && <div className="w-16 h-0.5 bg-border" />}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-2xl border border-border shadow-sm p-6">
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-slate-900">Upload Discharge Summary</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Patient</label>
                <select 
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={selectedPatient}
                  onChange={(e) => setSelectedPatient(e.target.value)}
                >
                  <option value="">Select a patient...</option>
                  <option value="1">Ravi Kumar (SYN-0002)</option>
                  <option value="2">Meena Iyer (SYN-0003)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Discharge Date</label>
                <input 
                  type="date" 
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Language</label>
                <select className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="ta">Tamil</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Discharge Summary Text</label>
                <textarea 
                  rows={8}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Paste the discharge summary text here..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Or upload file</label>
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:bg-slate-50 transition-colors cursor-pointer">
                  <Upload className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-600">Click to upload or drag and drop</p>
                  <p className="text-xs text-slate-500 mt-1">PDF, TXT, DOC up to 10MB</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button 
                onClick={() => setStep(2)}
                disabled={!selectedPatient}
                className="px-6 py-2 bg-primary hover:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-slate-900">What We Found</h2>
            <p className="text-sm text-slate-600">
              AI extraction results from the discharge summary
            </p>

            <div className="text-center py-12 text-slate-500">
              <FileText className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <p>Extraction results will appear here</p>
            </div>

            <div className="flex justify-between">
              <button 
                onClick={() => setStep(1)}
                className="px-6 py-2 bg-surface-container hover:bg-surface-container-high text-slate-700 font-medium rounded-lg transition-colors"
              >
                Back
              </button>
              <button 
                onClick={() => setStep(3)}
                className="px-6 py-2 bg-primary hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
              >
                Review & Publish
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-slate-900">Review & Publish</h2>
            <p className="text-sm text-slate-600">
              Review extracted items before publishing to the care plan
            </p>

            <div className="text-center py-12 text-slate-500">
              <CheckCircle className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <p>Review summary will appear here</p>
            </div>

            <div className="flex justify-between">
              <button 
                onClick={() => setStep(2)}
                className="px-6 py-2 bg-surface-container hover:bg-surface-container-high text-slate-700 font-medium rounded-lg transition-colors"
              >
                Back
              </button>
              <button 
                className="px-6 py-2 bg-primary hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
              >
                Publish Care Plan
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
