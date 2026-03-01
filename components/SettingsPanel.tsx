import React, { useEffect, useState } from 'react';

import type { ReaderSettings } from '../types';
import './settings-panel.css';

import { BookIcon, CloseIcon, PlayIcon, SpeakerIcon } from './icons';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ReaderSettings;
  onSettingsChange: (newSettings: Partial<ReaderSettings>) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose, settings, onSettingsChange }) => {
  const [activeTab, setActiveTab] = useState<'display' | 'readAloud'>('display');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (isOpen) {
      const loadVoices = () => {
        const availableVoices = window.speechSynthesis.getVoices();
        if (availableVoices.length > 0) {
          setVoices(availableVoices);
        }
      };

      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;

      return () => {
        window.speechSynthesis.onvoiceschanged = null;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleReadAloudChange = (newSettings: Partial<ReaderSettings['readAloud']>) => {
    onSettingsChange({ readAloud: { ...settings.readAloud, ...newSettings } });
  };

  const previewVoice = (voice: SpeechSynthesisVoice) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance('Hello, this is a preview of my voice.');
    utterance.voice = voice;
    utterance.rate = settings.readAloud.rate;
    utterance.pitch = settings.readAloud.pitch;
    window.speechSynthesis.speak(utterance);
  };

  const ReadAloudSettings = () => {
    const selectedVoice = voices.find(v => v.voiceURI === settings.readAloud.voiceURI);

    return (
      <div className="space-y-8">
        {/* Voice Selection */}
        <div>
          <label className="theme-text-secondary mb-2 block text-sm font-medium">
            Voice
          </label>

          <div className="theme-surface rounded-md p-3 mb-4">
            <p className="theme-text-muted text-center text-xs">Current Voice</p>
            <p className="font-semibold text-sky-300 truncate text-center" title={selectedVoice ? selectedVoice.name : 'System Default'}>
              {selectedVoice ? selectedVoice.name : 'System Default'}
            </p>
          </div>

          <p className="theme-text-muted mb-2 text-xs">Select a new voice from the list below:</p>

          <div className="theme-surface theme-border max-h-48 overflow-y-auto rounded-md border">
            <ul className="theme-divider divide-y">
              {voices.length > 0 ? (
                voices.map((voice) => (
                  <li
                    key={voice.voiceURI}
                    className={`flex items-center justify-between p-2 text-sm transition-colors ${settings.readAloud.voiceURI === voice.voiceURI
                        ? 'bg-sky-500/20 text-sky-300'
                        : 'theme-hover-surface'
                      }`}
                  >
                    <button
                      onClick={() => handleReadAloudChange({ voiceURI: voice.voiceURI })}
                      className="flex-grow text-left pr-2"
                    >
                      <span className="font-medium">{voice.name}</span>
                      <span className="theme-text-muted block text-xs">{voice.lang}</span>
                    </button>
                    <button
                      onClick={() => previewVoice(voice)}
                      className="theme-hover-surface shrink-0 rounded-full p-2"
                      aria-label={`Preview voice ${voice.name}`}
                    >
                      <PlayIcon className="w-4 h-4" />
                    </button>
                  </li>
                ))
              ) : (
                <li className="theme-text-muted p-4 text-center">Loading voices...</li>
              )}
            </ul>
          </div>
        </div>

        {/* Speed */}
        <div>
          <label htmlFor="read-speed" className="theme-text-secondary mb-2 block text-sm font-medium">
            Speed
          </label>
          <input
            id="read-speed"
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={settings.readAloud.rate}
            onChange={(e) => handleReadAloudChange({ rate: parseFloat(e.target.value) })}
            className="theme-slider h-2 w-full cursor-pointer appearance-none rounded-lg"
          />
          <div className="theme-text-muted mt-1 text-center text-sm">{settings.readAloud.rate.toFixed(1)}x</div>
        </div>

        {/* Pitch */}
        <div>
          <label htmlFor="read-pitch" className="theme-text-secondary mb-2 block text-sm font-medium">
            Pitch
          </label>
          <input
            id="read-pitch"
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={settings.readAloud.pitch}
            onChange={(e) => handleReadAloudChange({ pitch: parseFloat(e.target.value) })}
            className="theme-slider h-2 w-full cursor-pointer appearance-none rounded-lg"
          />
          <div className="theme-text-muted mt-1 text-center text-sm">{settings.readAloud.pitch.toFixed(1)}</div>
        </div>

      </div>
    );
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 z-30"
        onClick={onClose}
      />
      <div
        className={`theme-surface-elevated theme-border theme-text-primary fixed top-0 right-0 z-40 flex h-full w-80 transform flex-col border-l shadow-2xl transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-panel-title"
      >
        <div className="theme-divider flex shrink-0 items-center justify-between border-b p-4">
          <h3 id="settings-panel-title" className="theme-text-primary text-xl font-semibold">Settings</h3>
          <button onClick={onClose} aria-label="Close settings" className="theme-hover-surface rounded-full p-2">
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="theme-divider shrink-0 border-b px-2">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('display')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium border-b-2 transition-colors duration-200 ${activeTab === 'display'
                  ? 'border-sky-400 text-sky-300'
                  : 'theme-text-secondary border-transparent hover:text-sky-400 hover:border-slate-500'
                }`}
            >
              <BookIcon className="w-5 h-5" />
              Display
            </button>
            <button
              onClick={() => setActiveTab('readAloud')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium border-b-2 transition-colors duration-200 ${activeTab === 'readAloud'
                  ? 'border-sky-400 text-sky-300'
                  : 'theme-text-secondary border-transparent hover:text-sky-400 hover:border-slate-500'
                }`}
            >
              <SpeakerIcon className="w-5 h-5" />
              Read Aloud
            </button>
          </nav>
        </div>

        <div className="theme-text-primary grow overflow-y-auto p-6">
          {activeTab === 'display' && (
            <div className="space-y-8">
              {/* Font Size */}
              <div>
                <label htmlFor="font-size" className="theme-text-secondary mb-2 block text-sm font-medium">
                  Font Size
                </label>
                <div className="flex items-center space-x-4">
                  <span className="text-lg">A</span>
                  <input
                    id="font-size"
                    type="range"
                    min="80"
                    max="200"
                    step="1"
                    value={settings.fontSize}
                    onChange={(e) => onSettingsChange({ fontSize: parseInt(e.target.value, 10) })}
                    className="theme-slider h-2 w-full cursor-pointer appearance-none rounded-lg"
                  />
                  <span className="text-3xl">A</span>
                </div>
                <div className="theme-text-muted mt-1 text-center text-sm">{settings.fontSize}%</div>
              </div>

              {/* Theme */}
              <div>
                <label className="theme-text-secondary mb-2 block text-sm font-medium">
                  Theme
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => onSettingsChange({ theme: 'light' })}
                    className={`p-4 rounded-lg border-2 transition-colors ${settings.theme === 'light' ? 'border-sky-500 bg-sky-500/20' : 'border-slate-600 hover:border-slate-500'}`}
                  >
                    <div className="w-full h-12 bg-white rounded" />
                    <p className="mt-2 text-center text-sm font-medium">Light</p>
                  </button>
                  <button
                    onClick={() => onSettingsChange({ theme: 'dark' })}
                    className={`p-4 rounded-lg border-2 transition-colors ${settings.theme === 'dark' ? 'border-sky-500 bg-sky-500/20' : 'border-slate-600 hover:border-slate-500'}`}
                  >
                    <div className="w-full h-12 bg-gray-900 rounded" />
                    <p className="mt-2 text-center text-sm font-medium">Dark</p>
                  </button>
                </div>
              </div>

              {/* Font Family */}
              <div>
                <label className="theme-text-secondary mb-2 block text-sm font-medium">
                  Font Family
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['Original', 'Serif', 'Sans-Serif'].map((fontName) => (
                    <button
                      key={fontName}
                      onClick={() => onSettingsChange({ fontFamily: fontName })}
                      className={`py-2 px-1 rounded-lg border-2 transition-colors text-center text-sm truncate ${settings.fontFamily === fontName ? 'border-sky-500 bg-sky-500/20' : 'border-slate-600 hover:border-slate-500'}`}
                    >
                      <span className={fontName === 'Serif' ? 'font-serif-custom' : fontName === 'Sans-Serif' ? 'font-sans-custom' : 'font-original'}>
                        {fontName}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Reading Mode */}
              <div>
                <label className="theme-text-secondary mb-2 block text-sm font-medium">
                  Reading Mode
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => onSettingsChange({ flow: 'paginated' })}
                    className={`p-4 rounded-lg border-2 transition-colors text-center ${settings.flow === 'paginated' ? 'border-sky-500 bg-sky-500/20' : 'border-slate-600 hover:border-slate-500'}`}
                  >
                    <span className="block text-sm font-medium">Paginated</span>
                    <span className="theme-text-muted mt-1 block text-xs">Turn pages like a real book.</span>
                  </button>
                  <button
                    onClick={() => onSettingsChange({ flow: 'scrolled' })}
                    className={`p-4 rounded-lg border-2 transition-colors text-center ${settings.flow === 'scrolled' ? 'border-sky-500 bg-sky-500/20' : 'border-slate-600 hover:border-slate-500'}`}
                  >
                    <span className="block text-sm font-medium">Scrolled</span>
                    <span className="theme-text-muted mt-1 block text-xs">Scroll like a webpage.</span>
                  </button>
                </div>
              </div>

              {/* Citation Format */}
              <div>
                <label className="theme-text-secondary mb-2 block text-sm font-medium">
                  Citation Format
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['APA', 'MLA'].map((formatName) => (
                    <button
                      key={formatName}
                      onClick={() => onSettingsChange({ citationFormat: formatName.toLowerCase() as any })}
                      className={`py-2 px-1 rounded-lg border-2 transition-colors text-center text-sm truncate ${settings.citationFormat === formatName.toLowerCase() ? 'border-sky-500 bg-sky-500/20' : 'border-slate-600 hover:border-slate-500'}`}
                    >
                      {formatName}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {activeTab === 'readAloud' && (
            <ReadAloudSettings />
          )}
        </div>
      </div>
    </>
  );
};

export default SettingsPanel;
