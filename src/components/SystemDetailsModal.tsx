import React, { useEffect, useState } from 'react';
import { X, Check, User, Briefcase, Hash, Tag, KeyRound, ListChecks, FolderOpen, FileText } from 'lucide-react';
import { TravellerRecord } from '../types/traveller';
import { DigitalTestSheetSettingsService } from '../services/digitalTestSheetSettingsService';

interface SystemDetailsModalProps {
  isOpen: boolean;
  traveller: TravellerRecord;
  onClose: () => void;
  onUpdateDetails: (details: {
    serialNumber: string;
    customerName: string;
    jobNumber: string;
    partNumber: string;
    wirePasswords: string[];
  }) => void;
}

function getStepNotes(traveller: TravellerRecord, stepName: string): string {
  return traveller.steps.find((step) => step.name === stepName)?.notes || '';
}

function getMotorNames(traveller: TravellerRecord): string {
  const notes = getStepNotes(traveller, 'Pre System Test');
  const names = Array.from(notes.matchAll(/^\d+\.\s*(.*?)\s+—/gm), (match) => match[1].trim());
  return names.join(', ');
}

function getNetworkFolderNames(traveller: TravellerRecord): string {
  const notes = getStepNotes(traveller, 'Update Network Save Location');
  const marker = notes.includes('Customer data folders found:')
    ? 'Customer data folders found:'
    : 'Folders found:';
  const markerIndex = notes.indexOf(marker);
  if (markerIndex < 0) return '';
  return notes
    .slice(markerIndex + marker.length)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- ') && line !== '- (none)')
    .map((line) => line.slice(2))
    .join(', ');
}

function getSavedWireKey(traveller: TravellerRecord): string {
  if (traveller.wireKey) return traveller.wireKey;
  for (const step of traveller.steps) {
    const key = step.notes?.match(/WiRE Feature Permission Key:\s*(\S+)/)?.[1];
    if (key) return key;
  }
  return '';
}

function focusNextInputOnEnter(event: React.KeyboardEvent<HTMLInputElement>) {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  const container = event.currentTarget.closest('[data-enter-navigation]');
  const inputs = Array.from(
    container?.querySelectorAll<HTMLInputElement>('input[data-enter-next]') || []
  );
  const nextInput = inputs[inputs.indexOf(event.currentTarget) + 1];
  nextInput?.focus();
}

function SystemDetailsModalContent({
  isOpen,
  traveller,
  onClose,
  onUpdateDetails
}: SystemDetailsModalProps) {
  const [serialNumber, setSerialNumber] = useState(traveller.serialNumber);
  const [customerName, setCustomerName] = useState(traveller.customerName || '');
  const [jobNumber, setJobNumber] = useState(traveller.jobNumber || '');
  const [partNumber, setPartNumber] = useState(traveller.partNumber || '');
  const [wirePasswords, setWirePasswords] = useState(
    Array.from({ length: 4 }, (_, index) => traveller.wirePasswords?.[index] || '')
  );

  useEffect(() => {
    setSerialNumber(traveller.serialNumber || '');
    setCustomerName(traveller.customerName || '');
    setJobNumber(traveller.jobNumber || '');
    setPartNumber(traveller.partNumber || '');
    setWirePasswords(
      Array.from({ length: 4 }, (_, index) => traveller.wirePasswords?.[index] || '')
    );
  }, [traveller, isOpen]);

  if (!isOpen) return null;

  const combinations = (traveller.laserGratingCombinations || [])
    .filter((combination) => combination.wavelengthNm && combination.gratingDensityLinesPerMm)
    .map((combination) =>
      `${combination.cutoffValue ? `${combination.cutoffValue} cm⁻¹_` : ''}${Number(combination.wavelengthNm)}nm_${Number(combination.gratingDensityLinesPerMm)} lmm (PL: ${combination.pl ? 'Yes' : 'No'})`
    )
    .join(', ');
  const extraDataNotes = getStepNotes(traveller, 'Create Extra Data Files');
  const recordedExtraDataFiles = extraDataNotes.startsWith('Created files:')
    ? extraDataNotes
        .replace(/^Created files:\s*/, '')
        .split(/\r?\n/)
        .map((file) => file.trim())
        .filter(Boolean)
        .join(', ')
    : '';
  const extraDataFiles = recordedExtraDataFiles ||
    (traveller.laserGratingCombinations || [])
      .filter((combination) => combination.wavelengthNm && combination.gratingDensityLinesPerMm)
      .map((combination) =>
        `${Number(combination.wavelengthNm)}nm_${Number(combination.gratingDensityLinesPerMm)}.txt`
      )
      .join(', ');
  const motorNames = getMotorNames(traveller);
  const networkFolderNames = getNetworkFolderNames(traveller);
  const savedMeterSettings = DigitalTestSheetSettingsService.get();

  const handleApply = (event: React.FormEvent) => {
    event.preventDefault();
    onUpdateDetails({
      serialNumber: serialNumber.trim(),
      customerName: customerName.trim(),
      jobNumber: jobNumber.trim(),
      partNumber: partNumber.trim(),
      wirePasswords: wirePasswords.map((password) => password.trim())
    });
    onClose();
  };

  const textInputClass =
    'w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
        <div className="bg-slate-950 px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-semibold text-slate-100 uppercase tracking-wider">System Details</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close System Details"
            className="w-6 h-6 rounded text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <form onSubmit={handleApply} className="p-5 space-y-4 text-xs text-slate-300 overflow-y-auto">
          <div className="overflow-hidden rounded-lg border border-slate-800">
            <table className="w-full border-collapse" data-enter-navigation>
              <thead className="bg-slate-950 text-left uppercase tracking-wide text-[10px] text-slate-400">
                <tr>
                  <th className="w-2/5 border-b border-slate-800 px-3 py-2">Detail Name</th>
                  <th className="border-b border-slate-800 px-3 py-2">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                <tr>
                  <td className="px-3 py-2 text-slate-300">System</td>
                  <td className="px-3 py-2">{traveller.system}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-slate-300"><Hash className="mr-2 inline h-3.5 w-3.5 text-blue-400" />Serial Number</td>
                  <td className="px-3 py-1.5"><input data-enter-next aria-label="Serial Number" className={textInputClass} value={serialNumber} onChange={(event) => setSerialNumber(event.target.value)} onKeyDown={focusNextInputOnEnter} /></td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-slate-300"><Briefcase className="mr-2 inline h-3.5 w-3.5 text-blue-400" />Job Number</td>
                  <td className="px-3 py-1.5"><input data-enter-next aria-label="Job Number" className={textInputClass} value={jobNumber} onChange={(event) => setJobNumber(event.target.value)} onKeyDown={focusNextInputOnEnter} /></td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-slate-300"><Tag className="mr-2 inline h-3.5 w-3.5 text-blue-400" />Part Number</td>
                  <td className="px-3 py-1.5"><input data-enter-next aria-label="Part Number" className={textInputClass} value={partNumber} onChange={(event) => setPartNumber(event.target.value)} onKeyDown={focusNextInputOnEnter} /></td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-slate-300"><User className="mr-2 inline h-3.5 w-3.5 text-blue-400" />Customer Name</td>
                  <td className="px-3 py-1.5"><input data-enter-next aria-label="Customer Name" className={textInputClass} value={customerName} onChange={(event) => setCustomerName(event.target.value)} onKeyDown={focusNextInputOnEnter} /></td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-slate-300"><KeyRound className="mr-2 inline h-3.5 w-3.5 text-indigo-400" />WiRE Key</td>
                  <td className="px-3 py-2 break-all font-mono text-emerald-300">{getSavedWireKey(traveller) || 'Not recorded'}</td>
                </tr>
                {wirePasswords.map((password, index) => (
                  <tr key={index}>
                    <td className="px-3 py-2 text-slate-300">WiRE Password {index + 1}</td>
                    <td className="px-3 py-1.5">
                      <input
                        aria-label={`WiRE Password ${index + 1}`}
                        className={textInputClass}
                        data-enter-next
                        value={password}
                        onChange={(event) => setWirePasswords((current) =>
                          current.map((value, valueIndex) => valueIndex === index ? event.target.value : value)
                        )}
                        onKeyDown={focusNextInputOnEnter}
                      />
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="px-3 py-2 text-slate-300">Power Meter Serial Number</td>
                  <td className="px-3 py-2">{savedMeterSettings.powerMeterSerialNumber || 'Not recorded'}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-slate-300">Power Meter Head Serial Number</td>
                  <td className="px-3 py-2">{savedMeterSettings.powerMeterHeadSerialNumber || 'Not recorded'}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-slate-300">Motors Tested During Pre System Test</td>
                  <td className="px-3 py-2">{motorNames || 'Not recorded'}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-slate-300"><FolderOpen className="mr-2 inline h-3.5 w-3.5 text-amber-400" />Folders Found on Network</td>
                  <td className="px-3 py-2 break-words">{networkFolderNames || 'Not recorded'}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-slate-300">Laser/Grating</td>
                  <td className="px-3 py-2">{combinations || 'Not recorded'}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-slate-300"><FileText className="mr-2 inline h-3.5 w-3.5 text-blue-400" />Lines file details</td>
                  <td className="px-3 py-2 break-words">{extraDataFiles || 'Not recorded'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="border-t border-slate-800 pt-3 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs font-medium">
              Cancel
            </button>
            <button type="submit" className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" />
              <span>Save Details</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export const SystemDetailsModal: React.FC<SystemDetailsModalProps> = (props) => {
  if (!props.isOpen) return null;
  return <SystemDetailsModalContent {...props} />;
};
