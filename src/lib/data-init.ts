import { units as staticUnits } from './data';
import { 
  getFreshDbBookings, 
  saveDbBooking, 
  updateDbBookingStatus, 
  deleteDbBooking,
  getDbUnits, 
  updateDbUnitDetails 
} from './actions/db';

export const STORAGE_KEYS = {
  BOOKINGS: 'bookings',
  STUDIOS: 'studios',
};

// --- INITIALIZATION ---

export const initializeData = async () => {
  if (typeof window === 'undefined') return;
  
  // Note: Since we are moving to server-side JSON, 
  // initialization of JSON files is handled by the model manually once.
  // We can still use this to sync local cache if needed.
};

// --- UNITS ---

export const getSystemUnits = async () => {
  let units = staticUnits;

  // Try server-side first
  try {
    const dbUnits = await getDbUnits();
      if (dbUnits && dbUnits.length > 0) {
        units = staticUnits.map((su: any) => {
          const dbUnit = dbUnits.find((d: any) => d.id === su.id);
          if (!dbUnit) return su;
          
          const merged: any = { ...su };
          Object.keys(dbUnit).forEach(key => {
            const val = (dbUnit as any)[key];
            if (val !== null && val !== undefined && val !== '') {
              if (Array.isArray(val) && val.length === 0) return;
              if (typeof val === 'object' && !Array.isArray(val)) {
                if (Object.keys(val).length === 0) return;
              }
              merged[key] = val;
            }
          });
          return merged;
        });
    }
  } catch (e) {
    console.warn('DB Fetch failed, falling back to static');
  }

  // Merge with LocalStorage updates (if any)
  if (typeof window !== 'undefined') {
    try {
      const localUnits = JSON.parse(localStorage.getItem('local_units') || '[]');
      units = units.map(u => {
        const local = localUnits.find((l: any) => l.id === u.id);
        return local ? { ...u, ...local } : u;
      });
    } catch (e) {
      console.warn('Failed to merge local units');
    }
  }

  return units;
};

// Returns all physical units and apartments, excluding the 4 abstract master categories
export const getPublicSystemUnits = async () => {
  const allUnits = await getSystemUnits();
  return allUnits.filter(u => u.id !== 's-single' && u.id !== 's-double' && u.id !== 's-triple' && u.id !== 's-tworoom');
};

// Returns only the 7 display categories (hides the 24 physical studios)
export const getPublicCategoryUnits = async () => {
  const allUnits = await getSystemUnits();
  return allUnits.filter(u => !String(u.id).startsWith('b1-s') && !String(u.id).startsWith('b2-s') && u.branch !== 3);
};

export const updateUnitDetails = async (id: string, updates: any) => {
  try {
    return await updateDbUnitDetails(id, updates);
  } catch (e) {
    console.warn(`Failed to update unit details for ${id} in DB, applying locally:`, e);
    
    // Optional: save to localStorage to persist across refreshes during demo
    if (typeof window !== 'undefined') {
      const localUnits = JSON.parse(localStorage.getItem('local_units') || '[]');
      const index = localUnits.findIndex((u: any) => u.id === id);
      if (index !== -1) {
          localUnits[index] = { ...localUnits[index], ...updates };
      } else {
          localUnits.push({ id, ...updates });
      }
      localStorage.setItem('local_units', JSON.stringify(localUnits));
    }
    
    return await getSystemUnits();
  }
};

// Returns the 7 master units with calculated live availability from the 24 physical units
export const getPublicUnitsWithAvailability = async () => {
  const allUnits = await getSystemUnits();
  const bookings = await getBookings(Date.now().toString());
  const today = new Date().toISOString().split('T')[0];

  // 1. Get the 7 master categories
  const masterUnits = allUnits.filter(u => !String(u.id).startsWith('b1-s') && !String(u.id).startsWith('b2-s') && u.branch !== 3);

  // 2. Identify occupied physical units for today
  const occupiedIds = bookings
    .filter((b: any) => {
      // Logic: If today is within [checkIn, checkOut-1]
      return b.checkIn <= today && today < b.checkOut && (b.status === 'approved' || (b.status && b.status.includes('مؤكد')));
    })
    .map((b: any) => b.apartmentId);

  // 3. Map physical units to their categories and calculate availability
  // Physical units are identified by b1-s1 to b1-s24
  const physicalStudios = allUnits.filter(u => String(u.id).startsWith('b1-s'));

  return masterUnits.map(master => {
    let physicalGroup: any[] = [];
    
    // Simple mapping based on title (since my update script set these)
    if (master.id === 's-single') physicalGroup = physicalStudios.filter(p => p.title?.ar === 'استوديو سنجل');
    if (master.id === 's-double') physicalGroup = physicalStudios.filter(p => p.title?.ar === 'استوديو دبل');
    if (master.id === 's-triple') physicalGroup = physicalStudios.filter(p => p.title?.ar === 'استوديو تريبل');
    if (master.id === 's-tworoom') physicalGroup = physicalStudios.filter(p => p.title?.ar === 'استوديو غرفتين');
    
    // Apartments are handled individually or as a separate group
    if (master.type === 'apartment') {
      const isOccupied = occupiedIds.includes(master.id);
      return { ...master, availableCount: isOccupied ? 0 : 1, totalCount: 1 };
    }

    const available = physicalGroup.filter(p => !occupiedIds.includes(p.id)).length;
    
    return {
      ...master,
      availableCount: available,
      totalCount: physicalGroup.length
    };
  });
};

export const getBookings = async (nonce?: string) => {
  try {
    const dbBookings = await getFreshDbBookings(nonce);
    const localBookings = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('local_bookings') || '[]') : [];
    
    // Combine: Filter out nulls/no-id
    const combined = [...localBookings, ...dbBookings].filter(b => b && b.id);
    
    // Deduplicate by ID, keeping the one with the newest timestamp
    const uniqueMap = new Map();
    combined.forEach(item => {
      const existing = uniqueMap.get(item.id);
      const itemTime = item.timestamp ? new Date(item.timestamp).getTime() : 0;
      const existingTime = existing?.timestamp ? new Date(existing.timestamp).getTime() : 0;
      
      if (!existing || itemTime > existingTime) {
        uniqueMap.set(item.id, item);
      }
    });

    const unique = Array.from(uniqueMap.values());
    
    // Cleanup LocalStorage: If a record is in DB, we don't need it in LocalStorage anymore
    if (typeof window !== 'undefined' && dbBookings.length > 0) {
      const local = JSON.parse(localStorage.getItem('local_bookings') || '[]');
      const dbIds = new Set(dbBookings.map(b => b.id));
      const filteredLocal = local.filter((b: any) => !dbIds.has(b.id));
      if (local.length !== filteredLocal.length) {
        localStorage.setItem('local_bookings', JSON.stringify(filteredLocal));
      }
    }
    
    return unique.sort((a: any, b: any) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return timeB - timeA;
    });
  } catch (e) {
    console.error('DB Bookings fetch failed, falling back to local storage:', e);
    return typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('local_bookings') || '[]') : [];
  }
};

export const saveBooking = async (booking: any) => {
  try {
    const result = await saveDbBooking(booking);
    
    // Cleanup: If DB save succeeded, remove any local backup to avoid shadowing
    if (typeof window !== 'undefined' && result.success) {
       // Since we don't have the specific ID easily here anymore without searching the data, 
       // and since saveDbBooking now returns the fresh list, we can just clear any local bookings 
       // that might have been added during offline mode or just rely on the fresh data.
       // For now, let's just return the result data.
       return result.data;
    }
    
    return result.data;
  } catch (e) {
    console.warn('Database save failed, falling back to LocalStorage:', e);
    
    // Create local booking object
    const newBooking = {
      ...booking,
      id: `L-${Date.now()}`,
      status: 'رد جديد',
      timestamp: new Date().toISOString(),
    };
    
    if (typeof window !== 'undefined') {
      const local = JSON.parse(localStorage.getItem('local_bookings') || '[]');
      local.unshift(newBooking);
      localStorage.setItem('local_bookings', JSON.stringify(local));
    }
    
    return newBooking;
  }
};

export const updateBookingStatus = async (id: string, updates: any) => {
  try {
    const result = await updateDbBookingStatus(id, updates);
    
    // Cleanup: If DB update succeeded, remove any stale copy from LocalStorage
    if (typeof window !== 'undefined') {
      const local = JSON.parse(localStorage.getItem('local_bookings') || '[]');
      const filtered = local.filter((b: any) => b.id !== id);
      if (local.length !== filtered.length) {
        localStorage.setItem('local_bookings', JSON.stringify(filtered));
      }
    }
    
    return result;
  } catch (e) {
    console.warn('DB Update failed, applying to LocalStorage:', e);
    
    if (typeof window !== 'undefined') {
      const local = JSON.parse(localStorage.getItem('local_bookings') || '[]');
      const index = local.findIndex((b: any) => b.id === id);
      if (index !== -1) {
          local[index] = { ...local[index], ...updates };
      } else {
          // Adopt the booking from the current view into LocalStorage to override the DB state
          try {
            const all = await getBookings();
            const target = all.find((b: any) => b.id === id);
            if (target) {
              local.unshift({ ...target, ...updates });
            }
          } catch (innerError) {
            console.error('Failed to adopt booking locally:', innerError);
          }
      }
      localStorage.setItem('local_bookings', JSON.stringify(local));
    }
    
    return await getBookings();
  }
};

export const deleteBooking = async (id: string) => {
  try {
    const result = await deleteDbBooking(id);
    
    // Cleanup local storage if needed
    if (typeof window !== 'undefined') {
      const local = JSON.parse(localStorage.getItem('local_bookings') || '[]');
      const filtered = local.filter((b: any) => b.id !== id);
      if (local.length !== filtered.length) {
        localStorage.setItem('local_bookings', JSON.stringify(filtered));
      }
    }
    
    return result;
  } catch (e) {
    console.error('Error in deleteBooking:', e);
    throw e;
  }
};

export const deleteBookingsByPhone = async (phone: string) => {
  const { deleteDbBookingsByPhone } = await import('./actions/db');
  return await deleteDbBookingsByPhone(phone);
};

export const getStudios = async () => {
  const units = await getPublicSystemUnits();
  return units.filter((u: any) => u.type === 'studio');
};
