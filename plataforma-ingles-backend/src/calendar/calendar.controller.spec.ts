import { CalendarController } from './calendar.controller';

describe('CalendarController teacherUpdateEvent', () => {
  const calendarService = {
    getEventOrFail: jest.fn(),
    assertTeacherShift: jest.fn(),
    updateEvent: jest.fn(),
  };

  const controller = new CalendarController(calendarService as any);

  beforeEach(() => jest.clearAllMocks());

  it('re-checks permission when moving event to another shift', async () => {
    calendarService.getEventOrFail.mockResolvedValue({ id: 1, shiftId: 10 });
    calendarService.assertTeacherShift.mockResolvedValue({ userId: 5 });
    calendarService.updateEvent.mockResolvedValue({ id: 1 });

    await controller.teacherUpdateEvent({ userId: 5, token: 't' }, 1, { shiftId: 20 });

    expect(calendarService.assertTeacherShift).toHaveBeenCalledWith('t', 10);
    expect(calendarService.assertTeacherShift).toHaveBeenCalledWith('t', 20);
    expect(calendarService.updateEvent).toHaveBeenCalledWith(1, { shiftId: 20 });
  });
});
