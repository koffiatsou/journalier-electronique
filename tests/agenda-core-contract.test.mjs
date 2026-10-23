import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const agendaCode = fs.readFileSync(path.join(root, 'src/app/agenda-core.js'), 'utf8');

function createAgendaContext() {
  const context = {
    window: {},
    global: {},
    document: {
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => []
    },
    console,
    Date,
    Math,
    String,
    Number,
    Array,
    Object,
    Set,
    Map,
    RegExp,
    JSON,
    showAppToast: () => {},
    getDB: () => [],
    getStudents: () => [],
    DataStore: {
      getAgenda: () => ({ __events: [] }),
      saveAgenda: async () => {},
      getIdentity: () => ({ ownerId: 'test-owner' }),
      getSessions: () => [],
      saveSessions: () => {},
      getStudents: () => []
    }
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(agendaCode, context);
  return context;
}

test('Agenda Core : Contrat d’initialisation et export de JournalierAgenda', () => {
  const ctx = createAgendaContext();
  assert.ok(ctx.JournalierAgenda, 'JournalierAgenda doit être exposé');
  assert.equal(typeof ctx.JournalierAgenda.renderAgenda, 'function');
  assert.equal(typeof ctx.JournalierAgenda.getPrevisionnel, 'function');
  assert.equal(typeof ctx.JournalierAgenda.savePrevisionnel, 'function');
  assert.equal(typeof ctx.JournalierAgenda.agendaTimeToMinutes, 'function');
  assert.equal(typeof ctx.JournalierAgenda.agendaPeriodsFromTimes, 'function');
  assert.equal(typeof ctx.JournalierAgenda.eventOccursOnDate, 'function');
  assert.equal(typeof ctx.JournalierAgenda.getEventsForDate, 'function');
  assert.equal(typeof ctx.JournalierAgenda.normalizeAgendaConfig, 'function');
});

test('Agenda Core : Conversion heures <-> minutes et périodes', () => {
  const ctx = createAgendaContext();
  const { agendaTimeToMinutes, agendaMinutesToTime, agendaPeriodsFromTimes, DEFAULT_AGENDA_PERIODS } = ctx.JournalierAgenda;

  assert.equal(agendaTimeToMinutes('08:00'), 480);
  assert.equal(agendaTimeToMinutes('12:30'), 750);
  assert.equal(agendaTimeToMinutes('invalid'), -1);
  assert.equal(agendaMinutesToTime(480), '08:00');
  assert.equal(agendaMinutesToTime(750), '12:30');

  // Déduction de période
  const p1 = agendaPeriodsFromTimes('08:00', '08:50', DEFAULT_AGENDA_PERIODS);
  assert.equal(p1.startPeriod, '1e H');
  assert.equal(p1.endPeriod, '1e H');
});

test('Agenda Core : Calcul et manipulation des dates ISO scolaires', () => {
  const ctx = createAgendaContext();
  const { parseISODate, formatISO, getMonday, getDayIndexFromISO } = ctx.JournalierAgenda;

  const dt = parseISODate('2026-09-01');
  assert.equal(dt.getFullYear(), 2026);
  assert.equal(dt.getMonth(), 8); // Septembre (0-indexed = 8)
  assert.equal(dt.getDate(), 1);

  const formatted = formatISO(dt);
  assert.equal(formatted, '2026-09-01');

  // getMonday (2026-09-01 est un mardi, le lundi est le 2026-08-31)
  const monday = getMonday(dt);
  assert.equal(formatISO(monday), '2026-08-31');

  // getDayIndexFromISO (Lundi = 0, Mardi = 1, ...)
  assert.equal(getDayIndexFromISO('2026-08-31'), 0);
  assert.equal(getDayIndexFromISO('2026-09-01'), 1);
});

test('Agenda Core : Normalisation de la configuration des 8 périodes', () => {
  const ctx = createAgendaContext();
  const { normalizeAgendaConfig, DEFAULT_AGENDA_PERIODS } = ctx.JournalierAgenda;

  const config = normalizeAgendaConfig(DEFAULT_AGENDA_PERIODS);
  assert.equal(config.length, 8);
  assert.equal(config[0].label, '1e H');
  assert.equal(config[7].label, '8e H');
});

test('Agenda Core : Moteur de récurrence eventOccursOnDate', () => {
  const ctx = createAgendaContext();
  const { eventOccursOnDate } = ctx.JournalierAgenda;

  const uniqueEv = {
    eventId: 'u1',
    recurrence: 'unique',
    date: '2026-09-10'
  };
  assert.equal(eventOccursOnDate(uniqueEv, '2026-09-10'), true);
  assert.equal(eventOccursOnDate(uniqueEv, '2026-09-11'), false);

  const weeklyEv = {
    eventId: 'w1',
    seriesId: 's1',
    recurrence: 'weekly',
    recurrenceRange: {
      startDate: '2026-09-01'
    },
    recurrencePattern: {
      daysOfWeek: [1] // Mardi
    }
  };
  // 2026-09-01 est un mardi
  assert.equal(eventOccursOnDate(weeklyEv, '2026-09-01'), true);
  // 2026-09-08 est le mardi suivant
  assert.equal(eventOccursOnDate(weeklyEv, '2026-09-08'), true);
  // 2026-09-02 est un mercredi
  assert.equal(eventOccursOnDate(weeklyEv, '2026-09-02'), false);

  // Avec exception d'exclusion
  const prevWithEx = {
    __exceptions: {
      s1: ['2026-09-08']
    }
  };
  assert.equal(eventOccursOnDate(weeklyEv, '2026-09-08', prevWithEx), false);
  assert.equal(eventOccursOnDate(weeklyEv, '2026-09-15', prevWithEx), true);
});
