import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { TripList } from './components/TripList';
import { Modal } from './components/Modal';
import { AppData, Trip, Participant, DEFAULT_WEEK_NAME, PAYMENT_VALUE } from './types';
import { 
  loadAppData, 
  saveAppData, 
  generateWeekName, 
  generateParticipantId, 
  getAllUniqueNames, 
  generateShareText 
} from './services/dataUtils';
import { Menu, Plus, Upload, Download, Copy, Trash2, Edit } from 'lucide-react';

const App: React.FC = () => {
  // --- STATE ---
  const [data, setData] = useState<AppData>({ active_trips: [], currentWeekName: DEFAULT_WEEK_NAME });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile sidebar state
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true); // Desktop sidebar state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals State
  const [modalOpen, setModalOpen] = useState<'none' | 'newWeek' | 'addTrip' | 'backup'>('none');
  
  // Form States
  const [newWeekDate, setNewWeekDate] = useState('');
  const [newWeekError, setNewWeekError] = useState('');
  
  const [newTripDate, setNewTripDate] = useState('');
  const [newTripType, setNewTripType] = useState<'Ida' | 'Volta'>('Ida');
  const [selectedExistingNames, setSelectedExistingNames] = useState<Set<string>>(new Set());
  const [newParticipantInput, setNewParticipantInput] = useState('');

  // --- EFFECTS ---
  useEffect(() => {
    const loaded = loadAppData();
    setData(loaded);
  }, []);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const showToast = (msg: string) => setToastMessage(msg);

  // --- ACTIONS ---

  const saveData = (newData: AppData) => {
    setData(newData);
    saveAppData(newData);
  };

  const autoArchiveCurrent = (currentData: AppData): { archivedName: string | null, updatedData: AppData } => {
    const trips = currentData.active_trips;
    const name = currentData.currentWeekName;
    const newData = { ...currentData };

    if (trips.length > 0 || (name !== DEFAULT_WEEK_NAME && !newData[name])) {
      let archiveName = name;
      if (newData[archiveName] || archiveName === DEFAULT_WEEK_NAME) {
         archiveName = `${archiveName} (Arq. ${new Date().toLocaleDateString('pt-BR')}-${Date.now() % 1000})`;
      }
      newData[archiveName] = [...trips];
      newData.active_trips = [];
      newData.currentWeekName = DEFAULT_WEEK_NAME;
      return { archivedName: archiveName, updatedData: newData };
    }
    return { archivedName: null, updatedData: newData };
  };

  const handleCreateNewWeek = () => {
    if (!newWeekDate) {
      setNewWeekError('Selecione uma data.');
      return;
    }
    const newName = generateWeekName(newWeekDate);
    if (!newName) return;

    // Archive current
    const { archivedName, updatedData } = autoArchiveCurrent(data);
    
    if (updatedData[newName]) {
       setNewWeekError(`A semana "${newName}" já existe.`);
       return;
    }

    updatedData.currentWeekName = newName;
    updatedData.active_trips = [];
    
    saveData(updatedData);
    setModalOpen('none');
    setNewWeekDate('');
    setNewWeekError('');
    showToast(`✅ ${archivedName ? 'Anterior arquivada. ' : ''}Semana "${newName}" iniciada.`);
  };

  const handleSelectWeek = (weekName: string) => {
    if (weekName === data.currentWeekName) return;

    const { archivedName, updatedData } = autoArchiveCurrent(data);
    
    if (weekName === DEFAULT_WEEK_NAME) {
      updatedData.active_trips = [];
    } else {
      updatedData.active_trips = JSON.parse(JSON.stringify(updatedData[weekName] || []));
      delete updatedData[weekName]; // Remove from archive as it is now active
    }
    
    updatedData.currentWeekName = weekName;
    saveData(updatedData);
    showToast(`✅ Semana "${weekName}" carregada.`);
  };

  const handleDeleteWeek = (weekName: string) => {
    const isActive = weekName === data.currentWeekName;
    if (!confirm(`Excluir permanentemente a semana "${weekName}"?`)) return;

    const newData = { ...data };
    
    if (isActive) {
      newData.active_trips = [];
      newData.currentWeekName = DEFAULT_WEEK_NAME;
      // Try to load latest archive if available (simple fallback)
      // Logic simplified: just reset to default
    } else {
      delete newData[weekName];
    }
    
    saveData(newData);
    showToast(`🗑️ Semana "${weekName}" excluída.`);
  };

  const handleEditActiveWeekName = () => {
     if (data.currentWeekName === DEFAULT_WEEK_NAME) return;
     const newName = prompt("Novo nome da semana:", data.currentWeekName);
     if (newName && newName.trim() !== "") {
       if (data[newName.trim()]) {
         alert("Nome já existe.");
         return;
       }
       saveData({ ...data, currentWeekName: newName.trim() });
     }
  };

  const handleAddTrip = () => {
    if (!newTripDate) {
       alert("Selecione a data."); 
       return; 
    }

    // Process Date
    const daysPT = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    const dateObj = new Date(newTripDate + 'T12:00:00'); // Simple parsing
    const dayName = daysPT[dateObj.getDay()];
    const formattedDate = `${dayName} (${String(dateObj.getDate()).padStart(2,'0')}/${String(dateObj.getMonth()+1).padStart(2,'0')})`;

    // Participants
    const manualNames = newParticipantInput.split('\n').map(s => s.trim()).filter(s => s);
    const allNames = Array.from(new Set([...Array.from(selectedExistingNames), ...manualNames]));

    if (allNames.length === 0) {
      alert("Adicione participantes.");
      return;
    }

    const participants: Participant[] = allNames.map(name => ({
      id: generateParticipantId(name),
      name,
      paid: false
    }));

    const newTrip: Trip = {
      day: formattedDate,
      time: null,
      type: newTripType,
      participants
    };

    saveData({
      ...data,
      active_trips: [...data.active_trips, newTrip]
    });

    setModalOpen('none');
    setNewParticipantInput('');
    setSelectedExistingNames(new Set());
    setNewTripDate('');
    showToast("✅ Viagem adicionada.");
  };

  const handleDeleteTrip = (index: number) => {
    if (!confirm("Excluir viagem?")) return;
    const newTrips = [...data.active_trips];
    newTrips.splice(index, 1);
    saveData({ ...data, active_trips: newTrips });
  };

  const handleDeleteParticipant = (tIdx: number, pIdx: number) => {
     if (!confirm("Remover participante?")) return;
     const newTrips = [...data.active_trips];
     newTrips[tIdx].participants.splice(pIdx, 1);
     saveData({ ...data, active_trips: newTrips });
  };

  const handleEditParticipantName = (tIdx: number, pIdx: number) => {
    const currentName = data.active_trips[tIdx].participants[pIdx].name;
    const newName = prompt("Editar nome:", currentName);
    if (newName && newName.trim()) {
      const newTrips = [...data.active_trips];
      newTrips[tIdx].participants[pIdx].name = newName.trim();
      saveData({ ...data, active_trips: newTrips });
    }
  };

  const handleTogglePayment = (tIdx: number, pIdx: number) => {
    const newTrips = [...data.active_trips];
    newTrips[tIdx].participants[pIdx].paid = !newTrips[tIdx].participants[pIdx].paid;
    saveData({ ...data, active_trips: newTrips });
  };

  // --- STATS ---
  const totalPayers = data.active_trips.reduce((acc, t) => acc + t.participants.filter(p => p.paid).length, 0);
  const totalParticipants = data.active_trips.reduce((acc, t) => acc + t.participants.length, 0);
  const totalReceived = totalPayers * PAYMENT_VALUE;

  // --- BACKUP ---
  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `caronas_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Backup baixado.");
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        if (typeof json === 'object') {
          saveData(json);
          setModalOpen('none');
          showToast("Dados restaurados.");
        }
      } catch (err) {
        alert("Erro no arquivo JSON.");
      }
    };
    reader.readAsText(file);
  };

  const handleExportText = () => {
    const text = generateShareText(data.active_trips, totalPayers, totalReceived, data.currentWeekName);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `status_pagamento.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Texto exportado.");
  };

  const uniqueNames = useCallback(() => getAllUniqueNames(data), [data]);

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900 font-sans">
      
      {/* SIDEBAR */}
      <Sidebar 
        data={data}
        isOpen={isSidebarOpen}
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        isDesktopOpen={isDesktopSidebarOpen}
        onDesktopToggle={() => setIsDesktopSidebarOpen(!isDesktopSidebarOpen)}
        onSelectWeek={handleSelectWeek}
        onDeleteWeek={handleDeleteWeek}
        onOpenNewWeek={() => { setModalOpen('newWeek'); setIsSidebarOpen(false); }}
        onOpenBackup={() => { setModalOpen('backup'); setIsSidebarOpen(false); }}
      />

      {/* MAIN CONTENT */}
      {/* Updated margin logic: ml-72 when desktop open, ml-0 when closed */}
      <div className={`flex-1 flex flex-col transition-all duration-300 md:ml-0 ${isDesktopSidebarOpen ? 'md:ml-72' : ''}`}>
        
        {/* MOBILE HEADER */}
        <header className="md:hidden bg-white border-b border-gray-200 p-4 sticky top-0 z-20 flex items-center justify-between shadow-sm">
          <h1 className="text-lg font-bold text-indigo-900">Controle Caronas</h1>
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-indigo-600 rounded-lg bg-indigo-50">
            <Menu size={24} />
          </button>
        </header>

        {/* TOAST */}
        <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ${toastMessage ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
           <div className="bg-gray-900 text-white px-6 py-3 rounded-full shadow-2xl text-sm font-medium flex items-center gap-2">
             {toastMessage}
           </div>
        </div>

        <main className="flex-1 p-4 md:p-8 max-w-4xl mx-auto w-full">
          
          {/* HEADER CARD */}
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl shadow-xl overflow-hidden mb-8 text-white">
             <div className="p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
               <div>
                 <div className="flex items-center gap-2 text-indigo-200 text-sm font-medium mb-1">
                   <span>Semana Ativa</span>
                 </div>
                 <div className="flex items-center gap-3">
                   <h2 className="text-2xl md:text-3xl font-bold">{data.currentWeekName}</h2>
                   <button onClick={handleEditActiveWeekName} className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
                     <Edit size={16} />
                   </button>
                 </div>
               </div>
               
               <div className="flex gap-6 bg-white/10 p-4 rounded-xl backdrop-blur-sm">
                  <div className="text-center">
                    <div className="text-xs text-indigo-200 uppercase tracking-wider font-semibold">Total (R$)</div>
                    <div className="text-2xl font-bold text-emerald-300">R$ {totalReceived.toFixed(2).replace('.', ',')}</div>
                  </div>
                  <div className="w-px bg-white/20"></div>
                  <div className="text-center">
                    <div className="text-xs text-indigo-200 uppercase tracking-wider font-semibold">Pagamentos</div>
                    <div className="text-2xl font-bold">{totalPayers} <span className="text-lg text-indigo-300 font-normal">/ {totalParticipants}</span></div>
                  </div>
               </div>
             </div>
          </div>

          {/* ACTION BAR */}
          <div className="mb-6">
            <button 
              onClick={() => setModalOpen('addTrip')}
              className="w-full md:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-emerald-600/20 transition-all transform hover:-translate-y-0.5 active:scale-95"
            >
              <Plus size={20} />
              Adicionar Trecho
            </button>
          </div>

          {/* LIST */}
          <TripList 
            trips={data.active_trips}
            currentWeekName={data.currentWeekName}
            onDeleteTrip={handleDeleteTrip}
            onTogglePayment={handleTogglePayment}
            onDeleteParticipant={handleDeleteParticipant}
            onEditParticipantName={handleEditParticipantName}
          />

        </main>
      </div>

      {/* --- MODALS --- */}

      <Modal isOpen={modalOpen === 'newWeek'} onClose={() => setModalOpen('none')} title="Nova Semana">
         <div className="space-y-4">
           <p className="text-gray-600 text-sm">Selecione o dia inicial (Domingo/Segunda). O nome será gerado automaticamente.</p>
           <input 
              type="date" 
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              value={newWeekDate}
              onChange={(e) => setNewWeekDate(e.target.value)}
           />
           {newWeekError && <p className="text-red-500 text-sm">{newWeekError}</p>}
           <div className="flex justify-end gap-2 pt-2">
             <button onClick={() => setModalOpen('none')} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Cancelar</button>
             <button onClick={handleCreateNewWeek} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">Criar Semana</button>
           </div>
         </div>
      </Modal>

      <Modal isOpen={modalOpen === 'addTrip'} onClose={() => setModalOpen('none')} title="Adicionar Viagem">
         <div className="space-y-4">
           <div className="grid grid-cols-3 gap-4">
             <div className="col-span-2">
               <label className="block text-xs font-medium text-gray-700 mb-1">Data</label>
               <input 
                  type="date" 
                  className="w-full p-2 border border-gray-300 rounded-lg"
                  value={newTripDate}
                  onChange={(e) => setNewTripDate(e.target.value)}
               />
             </div>
             <div>
               <label className="block text-xs font-medium text-gray-700 mb-1">Tipo</label>
               <select 
                  className="w-full p-2 border border-gray-300 rounded-lg"
                  value={newTripType}
                  onChange={(e) => setNewTripType(e.target.value as 'Ida' | 'Volta')}
               >
                 <option value="Ida">Ida</option>
                 <option value="Volta">Volta</option>
               </select>
             </div>
           </div>

           <div>
             <label className="block text-xs font-medium text-gray-700 mb-2">Participantes Recentes</label>
             <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2 bg-gray-50 grid grid-cols-2 gap-2">
               {uniqueNames().map(name => (
                 <label key={name} className="flex items-center gap-2 p-1.5 hover:bg-white rounded cursor-pointer transition-colors text-sm">
                   <input 
                      type="checkbox" 
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                      checked={selectedExistingNames.has(name)}
                      onChange={(e) => {
                        const newSet = new Set(selectedExistingNames);
                        if (e.target.checked) newSet.add(name);
                        else newSet.delete(name);
                        setSelectedExistingNames(newSet);
                      }}
                   />
                   <span className="truncate">{name}</span>
                 </label>
               ))}
               {uniqueNames().length === 0 && <span className="text-gray-400 text-xs italic col-span-2">Nenhum histórico.</span>}
             </div>
           </div>

           <div>
             <label className="block text-xs font-medium text-gray-700 mb-1">Novos Nomes (um por linha)</label>
             <textarea 
                className="w-full p-2 border border-gray-300 rounded-lg h-20 text-sm resize-none"
                placeholder="Ex: João Silva..."
                value={newParticipantInput}
                onChange={(e) => setNewParticipantInput(e.target.value)}
             />
           </div>

           <div className="flex justify-end gap-2 pt-2">
             <button onClick={() => setModalOpen('none')} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Cancelar</button>
             <button onClick={handleAddTrip} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">Adicionar</button>
           </div>
         </div>
      </Modal>

      <Modal isOpen={modalOpen === 'backup'} onClose={() => setModalOpen('none')} title="Backup e Exportação">
         <div className="space-y-6">
           <div className="space-y-3">
             <h4 className="font-semibold text-indigo-900 border-b pb-1">Backup Completo (JSON)</h4>
             <p className="text-xs text-gray-500">Salve todo o histórico ou restaure em outro dispositivo.</p>
             <div className="flex gap-2">
               <button onClick={handleExportJSON} className="flex-1 flex items-center justify-center gap-2 bg-indigo-100 text-indigo-700 py-2 rounded-lg hover:bg-indigo-200 font-medium text-sm">
                 <Download size={16} /> Baixar Backup
               </button>
               <label className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 font-medium text-sm cursor-pointer">
                 <Upload size={16} /> Restaurar
                 <input type="file" accept=".json" className="hidden" onChange={handleImportJSON} />
               </label>
             </div>
           </div>

           <div className="space-y-3">
             <h4 className="font-semibold text-green-800 border-b pb-1">Texto para Compartilhar</h4>
             <p className="text-xs text-gray-500">Gera um resumo da semana atual em texto.</p>
             <textarea 
                readOnly
                className="w-full h-24 p-2 bg-gray-50 border rounded text-xs font-mono"
                value={generateShareText(data.active_trips, totalPayers, totalReceived, data.currentWeekName)}
             />
             <button onClick={handleExportText} className="w-full flex items-center justify-center gap-2 bg-green-100 text-green-700 py-2 rounded-lg hover:bg-green-200 font-medium text-sm">
               <Copy size={16} /> Baixar .txt
             </button>
           </div>
         </div>
      </Modal>

    </div>
  );
};

export default App;