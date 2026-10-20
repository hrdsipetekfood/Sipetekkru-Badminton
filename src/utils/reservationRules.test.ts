import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTimeToMinutes,
  minutesToTime,
  calculateEndTime,
  validateSessionDuration,
  validateMaxSessionsPerDay,
  validateParticipants,
  checkIsAdmin,
  validateReservationForm,
  ADMIN_EMAIL,
  MAX_SESSIONS_PER_DAY,
  MAX_PARTICIPANTS_PER_SESSION,
} from './reservationRules.ts';

test('parseTimeToMinutes converts HH:mm correctly', () => {
  assert.equal(parseTimeToMinutes('00:00'), 0);
  assert.equal(parseTimeToMinutes('01:30'), 90);
  assert.equal(parseTimeToMinutes('19:00'), 1140);
  assert.equal(parseTimeToMinutes('23:59'), 1439);
  assert.equal(parseTimeToMinutes('invalid'), -1);
});

test('calculateEndTime always calculates exactly 60 minutes after start time', () => {
  assert.equal(calculateEndTime('08:00'), '09:00');
  assert.equal(calculateEndTime('19:30'), '20:30');
  assert.equal(calculateEndTime('23:00'), '00:00');
});

test('validateSessionDuration enforces strict 60 minutes rule', () => {
  // Exactly 60 mins -> valid
  const valid = validateSessionDuration('18:00', '19:00');
  assert.equal(valid.valid, true);
  assert.equal(valid.durationMinutes, 60);

  // 45 mins -> invalid
  const shortSession = validateSessionDuration('18:00', '18:45');
  assert.equal(shortSession.valid, false);
  assert.equal(shortSession.durationMinutes, 45);
  assert.match(shortSession.error || '', /exactly 60 minutes/);

  // 90 mins -> invalid
  const longSession = validateSessionDuration('18:00', '19:30');
  assert.equal(longSession.valid, false);
  assert.equal(longSession.durationMinutes, 90);
});

test('validateMaxSessionsPerDay enforces maximum 2 sessions per day', () => {
  const existing = [
    { id: 'res-1', date: '2026-10-25' },
    { id: 'res-2', date: '2026-10-25' },
    { id: 'res-3', date: '2026-10-26' },
  ];

  // Adding on 2026-10-25 already has 2 -> blocked
  const resOct25 = validateMaxSessionsPerDay(existing, '2026-10-25');
  assert.equal(resOct25.allowed, false);
  assert.equal(resOct25.currentCount, 2);
  assert.match(resOct25.error || '', /Maximum of 2 sessions/);

  // Adding on 2026-10-26 has 1 -> allowed
  const resOct26 = validateMaxSessionsPerDay(existing, '2026-10-26');
  assert.equal(resOct26.allowed, true);
  assert.equal(resOct26.currentCount, 1);

  // Adding on 2026-10-27 has 0 -> allowed
  const resOct27 = validateMaxSessionsPerDay(existing, '2026-10-27');
  assert.equal(resOct27.allowed, true);
  assert.equal(resOct27.currentCount, 0);

  // Editing existing session on 2026-10-25 (excludeId = 'res-1') -> allowed (count becomes 1)
  const editOct25 = validateMaxSessionsPerDay(existing, '2026-10-25', 'res-1');
  assert.equal(editOct25.allowed, true);
  assert.equal(editOct25.currentCount, 1);
});

test('validateParticipants enforces max 4 participants and minimum 1 non-empty name', () => {
  // Valid 4 participants
  const four = validateParticipants(['Budi', 'Siti', 'Agus', 'Dewi']);
  assert.equal(four.valid, true);
  assert.equal(four.count, 4);

  // Valid 2 participants
  const two = validateParticipants(['  Rian  ', 'Eka']);
  assert.equal(two.valid, true);
  assert.equal(two.count, 2);
  assert.deepEqual(two.cleanList, ['Rian', 'Eka']);

  // Over limit: 5 participants -> invalid
  const five = validateParticipants(['A', 'B', 'C', 'D', 'E']);
  assert.equal(five.valid, false);
  assert.match(five.error || '', /Maximum of 4 participants/);

  // Empty list -> invalid
  const empty = validateParticipants(['   ', '']);
  assert.equal(empty.valid, false);
  assert.match(empty.error || '', /At least 1 participant/);
});

test('checkIsAdmin strictly authorises only hrdsipetekfood@gmail.com', () => {
  assert.equal(checkIsAdmin('hrdsipetekfood@gmail.com'), true);
  assert.equal(checkIsAdmin('HRDSIpetekfood@gmail.com'), true); // case insensitive check
  assert.equal(checkIsAdmin('hrdsipetekfood@gmail.com '), true); // trimmed
  assert.equal(checkIsAdmin('guest@sipetek.com'), false);
  assert.equal(checkIsAdmin('other@gmail.com'), false);
  assert.equal(checkIsAdmin(null), false);
  assert.equal(checkIsAdmin(undefined), false);
  assert.equal(checkIsAdmin(''), false);
});

test('validateReservationForm validates composite rules correctly', () => {
  const existing = [{ id: '1', date: '2026-10-21' }];

  const validData = {
    date: '2026-10-21',
    startTime: '19:00',
    endTime: '20:00',
    participants: ['Asep', 'Doni'],
  };

  const validation = validateReservationForm(validData, existing);
  assert.equal(validation.isValid, true);
  assert.deepEqual(validation.errors, {});

  // Invalid when 60 mins violated and empty participants
  const invalidData = {
    date: '2026-10-21',
    startTime: '19:00',
    endTime: '19:45',
    participants: [],
  };

  const badValidation = validateReservationForm(invalidData, existing);
  assert.equal(badValidation.isValid, false);
  assert.ok(badValidation.errors.endTime);
  assert.ok(badValidation.errors.participants);
});
