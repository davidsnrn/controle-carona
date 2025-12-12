import { AppData, Trip, DEFAULT_WEEK_NAME } from '../types';

export const loadAppData = (): AppData => {
  try {
    const stored = localStorage.getItem('carona_payment_data_v4');
    if (stored) {
      const data = JSON.parse(stored);
      if (!data.active_trips) data.active_trips = [];
      if (!data.currentWeekName) data.currentWeekName = DEFAULT_WEEK_NAME;
      return data;
    }
  } catch (e) {
    console.error("Failed to load data", e);
  }
  return {
    active_trips: [],
    currentWeekName: DEFAULT_WEEK_NAME
  };
};

export const saveAppData = (data: AppData) => {
  try {
    localStorage.setItem('carona_payment_data_v4', JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save data", e);
  }
};

export const generateParticipantId = (name: string) => 
  `p-${Date.now()}-${name.replace(/\s/g, '').toLowerCase().substring(0, 5)}`;

export const formatDate = (date: Date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

export const generateWeekName = (startDateString: string) => {
  if (!startDateString) return null;
  const parts = startDateString.split('-');
  const year = parseInt(parts[0]);
  const month = parseInt(parts[1]) - 1;
  const day = parseInt(parts[2]);
  const startDate = new Date(year, month, day);
  
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 4);

  return `Semana ${formatDate(startDate)} - ${formatDate(endDate)}`;
};

export const parseStartDateFromWeekName = (weekName: string): Date | null => {
  const match = weekName.match(/Semana (\d{2}\/\d{2}\/\d{4})/);
  if (match) {
    const parts = match[1].split('/').map(Number);
    return new Date(parts[2], parts[1] - 1, parts[0]);
  }
  return null;
};

export const getAllUniqueNames = (data: AppData): string[] => {
  const names = new Set<string>();
  
  // Add from active
  data.active_trips.forEach(trip => {
    trip.participants.forEach(p => names.add(p.name));
  });

  // Add from archives
  Object.keys(data).forEach(key => {
    if (key !== 'active_trips' && key !== 'currentWeekName' && Array.isArray(data[key])) {
      (data[key] as Trip[]).forEach(trip => {
        trip.participants.forEach(p => names.add(p.name));
      });
    }
  });

  return Array.from(names).sort((a, b) => a.localeCompare(b, 'pt-BR'));
};

export const generateShareText = (trips: Trip[], payers: number, totalReceived: number, weekName: string) => {
  let text = `📅 Status de Pagamento de Caronas - ${weekName}\n`;
  text += `💰 Total Recebido: R$ ${totalReceived.toFixed(2).replace('.', ',')}\n`;
  text += `👥 Pagamentos Concluídos: ${payers}\n`;
  text += '==================================================\n\n';

  if (trips.length === 0) {
    text += 'Nenhuma viagem cadastrada nesta semana ativa.';
    return text;
  }

  trips.forEach(trip => {
    text += `📅 ${trip.day} - ${trip.type}:\n`;
    trip.participants.forEach(p => {
      const status = p.paid ? '✅ PAGO' : '❌ PENDENTE';
      text += `- ${p.name}: ${status}\n`;
    });
    text += '\n';
  });
  return text;
};
