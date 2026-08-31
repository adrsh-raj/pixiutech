/**
 * PIXIU TECH - DATABASE CLIENT
 * 
 * This file acts as the abstraction layer for the database.
 * Currently, it uses an advanced Async LocalStorage mock that perfectly mimics 
 * Supabase/Postgres syntax. 
 * 
 * To migrate to real Supabase, simply replace this file with the official 
 * @supabase/supabase-js client initialization. Zero UI changes will be needed.
 */

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class MockSupabaseQueryBuilder {
  constructor(table) {
    this.table = table;
    this.data = JSON.parse(localStorage.getItem(`pixiu_db_${table}`)) || [];
  }

  async select(columns = '*') {
    await delay(300); // Simulate network latency
    return { data: this.data, error: null };
  }

  async insert(record) {
    await delay(400);
    const newRecord = { ...record, id: record.id || Date.now().toString(), created_at: new Date().toISOString() };
    const newData = [...this.data, newRecord];
    localStorage.setItem(`pixiu_db_${this.table}`, JSON.stringify(newData));
    return { data: [newRecord], error: null };
  }

  async update(record) {
    await delay(400);
    const index = this.data.findIndex(r => r.id === record.id);
    if (index === -1) return { data: null, error: { message: 'Record not found' } };
    
    const updatedRecord = { ...this.data[index], ...record, updated_at: new Date().toISOString() };
    const newData = [...this.data];
    newData[index] = updatedRecord;
    
    localStorage.setItem(`pixiu_db_${this.table}`, JSON.stringify(newData));
    return { data: [updatedRecord], error: null };
  }

  async delete(matchObj) {
    await delay(400);
    const key = Object.keys(matchObj)[0];
    const value = matchObj[key];
    const newData = this.data.filter(r => r[key] !== value);
    localStorage.setItem(`pixiu_db_${this.table}`, JSON.stringify(newData));
    return { data: null, error: null };
  }
}

class MockSupabaseClient {
  from(table) {
    return new MockSupabaseQueryBuilder(table);
  }
}

// Export the singleton instance
export const supabase = new MockSupabaseClient();

// Seed initial data if DB is empty
export const seedDatabase = async () => {
  if (!localStorage.getItem('pixiu_db_schools')) {
    const initialSchools = [
      { id: 'ZPS', name: 'Zenith Public School', principal: 'Dr. R.K. Sharma', contact: '9876543210', status: 'Active', renewal: '2027-03-31', students: 120, revenue: 150000 },
      { id: 'SXV', name: 'St. Xavier Academy', principal: 'Fr. Thomas', contact: '9876543211', status: 'Active', renewal: '2027-04-15', students: 85, revenue: 120000 },
      { id: 'GWS', name: 'Global World School', principal: 'Mrs. S. Gupta', contact: '9876543212', status: 'At Risk', renewal: '2026-09-30', students: 45, revenue: 80000 }
    ];
    localStorage.setItem('pixiu_db_schools', JSON.stringify(initialSchools));
  }
  
  if (!localStorage.getItem('pixiu_db_students')) {
    const initialStudents = [
      { id: 'ZPS6A 01', schoolCode: 'ZPS', schoolName: 'Zenith Public School', class: '6', section: 'A', roll: '01', name: 'Aarav Sharma', parent: 'Ravi Sharma', phone: '919876543210', level: 'Level 2' },
      { id: 'ZPS6  02', schoolCode: 'ZPS', schoolName: 'Zenith Public School', class: '6', section: '', roll: '02', name: 'Priya Patel', parent: 'Meera Patel', phone: '919876543211', level: 'Level 3' }
    ];
    localStorage.setItem('pixiu_db_students', JSON.stringify(initialStudents));
  }
};
