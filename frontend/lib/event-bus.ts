// Simple event bus for component communication
type EventCallback = () => void

class EventBus {
  private events: { [key: string]: EventCallback[] } = {}

  // Subscribe to an event
  on(event: string, callback: EventCallback) {
    if (!this.events[event]) {
      this.events[event] = []
    }
    this.events[event].push(callback)
  }

  // Unsubscribe from an event
  off(event: string, callback: EventCallback) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(cb => cb !== callback)
    }
  }

  // Emit an event
  emit(event: string) {
    if (this.events[event]) {
      this.events[event].forEach(callback => callback())
    }
  }
}

// Create a singleton instance
export const eventBus = new EventBus()

// Event names
export const EVENTS = {
  DASHBOARD_REFRESH: 'dashboard:refresh',
  CONTRACT_UPDATED: 'contract:updated',
  MAINTENANCE_COMPLETED: 'maintenance:completed',
  REPAIR_COMPLETED: 'repair:completed',
  USER_UPDATED: 'user:updated'
} as const

