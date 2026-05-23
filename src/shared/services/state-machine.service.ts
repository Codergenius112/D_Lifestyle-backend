import { BookingStatus } from '../enums';

export class BookingStateMachine {
  private currentState: BookingStatus;

  constructor(initialState: BookingStatus = BookingStatus.INITIATED) {
    this.currentState = initialState;
  }

  canTransition(targetState: BookingStatus): boolean {
    const validTransitions: Record<BookingStatus, BookingStatus[]> = {
      [BookingStatus.INITIATED]: [
        BookingStatus.PENDING_PAYMENT,
        BookingStatus.PENDING_GROUP_PAYMENT,
        BookingStatus.CANCELLED,
      ],
      [BookingStatus.PENDING_PAYMENT]: [
        BookingStatus.CONFIRMED,
        BookingStatus.CANCELLED,
        BookingStatus.EXPIRED,
      ],
      [BookingStatus.PENDING_GROUP_PAYMENT]: [
        BookingStatus.CONFIRMED,
        BookingStatus.CANCELLED,
        BookingStatus.EXPIRED,
      ],
      [BookingStatus.CONFIRMED]: [
        BookingStatus.CHECKED_IN,
        BookingStatus.ACTIVE,
        BookingStatus.CANCELLED,
      ],
      [BookingStatus.CHECKED_IN]: [
        BookingStatus.COMPLETED,
        BookingStatus.CANCELLED,
      ],
      [BookingStatus.ACTIVE]: [
        BookingStatus.COMPLETED,
        BookingStatus.CANCELLED,
      ],
      [BookingStatus.COMPLETED]: [],
      [BookingStatus.CANCELLED]: [],
      [BookingStatus.EXPIRED]: [],
    };

    return (validTransitions[this.currentState] || []).includes(targetState);
  }

  transition(targetState: BookingStatus): void {
    if (!this.canTransition(targetState)) {
      throw new Error(
        `Invalid transition from ${this.currentState} to ${targetState}`,
      );
    }
    this.currentState = targetState;
  }

  getState(): BookingStatus {
    return this.currentState;
  }
}
