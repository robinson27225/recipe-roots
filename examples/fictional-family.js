// A made-up family for demos and screenshots. The WikiTree IDs are deliberately fake
// ("Demo-..."), so nothing here points at a real person's profile.
const p = (o) => ({ IsLiving: 0, ...o });
const IE = 'County Cork, Ireland', BOS = 'Boston, Suffolk, Massachusetts, United States';
export const rootId = 1;
export const people = new Map([
  [1, p({ Id: 1, Name: 'Demo-Hale-1', FirstName: 'Sam', LastNameAtBirth: 'Hale', BirthDate: '1988-01-01', BirthLocation: 'Worcester, Massachusetts, USA', IsLiving: 1, Father: 2, Mother: 3 })],
  [2, p({ Id: 2, Name: 'Demo-Hale-2', FirstName: 'Frank', LastNameAtBirth: 'Hale', Gender: 'Male', BirthDate: '1958-05-05', BirthLocation: 'Worcester, Massachusetts, USA', DeathDate: '2016-02-02', DeathLocation: 'Worcester, Massachusetts, USA', Father: 6, Mother: 7 })],
  [3, p({ Id: 3, Name: 'Demo-Murphy-3', FirstName: 'Mary', LastNameAtBirth: 'Murphy', Gender: 'Female', BirthDate: '1930-03-03', BirthLocation: `${BOS}`, DeathDate: '2009-01-01', DeathLocation: 'Boston, Massachusetts', Father: 4, Mother: 5 })],
  [4, p({ Id: 4, Name: 'Demo-Murphy-4', FirstName: 'Patrick', LastNameAtBirth: 'Murphy', Gender: 'Male', BirthDate: '1893-06-06', BirthLocation: 'Skibbereen, County Cork, Ireland', DeathDate: '1962-01-01', DeathLocation: BOS, Father: 8, Mother: 9 })],
  [5, p({ Id: 5, Name: 'Demo-Walsh-5', FirstName: 'Nora', LastNameAtBirth: 'Walsh', Gender: 'Female', BirthDate: '1897-04-04', BirthLocation: 'Cork, County Cork, Ireland', DeathDate: '1975-08-08', DeathLocation: BOS, Father: 10, Mother: 11 })],
  [6, p({ Id: 6, Name: 'Demo-Hale-6', FirstName: 'Walter', LastNameAtBirth: 'Hale', Gender: 'Male', BirthDate: '1925-02-02', BirthLocation: 'Springfield, Massachusetts, USA', DeathDate: '1999-02-02', DeathLocation: 'Worcester, Massachusetts, USA' })],
  [7, p({ Id: 7, Name: 'Demo-Brandt-7', FirstName: 'Greta', LastNameAtBirth: 'Brandt', Gender: 'Female', BirthDate: '1928-09-09', BirthLocation: 'Hartford, Connecticut, USA', DeathDate: '2004-09-09', DeathLocation: 'Worcester, Massachusetts, USA' })],
  [8, p({ Id: 8, Name: 'Demo-Murphy-8', FirstName: 'Cornelius', LastNameAtBirth: 'Murphy', Gender: 'Male', BirthDate: '1858-01-01', BirthLocation: IE, DeathDate: '1921-01-01', DeathLocation: IE })],
  [9, p({ Id: 9, Name: 'Demo-Daly-9', FirstName: 'Hannah', LastNameAtBirth: 'Daly', Gender: 'Female', BirthDate: '1862-01-01', BirthLocation: IE, DeathDate: '1930-01-01', DeathLocation: IE })],
  [10, p({ Id: 10, Name: 'Demo-Walsh-10', FirstName: 'Michael', LastNameAtBirth: 'Walsh', Gender: 'Male', BirthDate: '1860-01-01', BirthLocation: 'Cork, Ireland', DeathDate: '1935-01-01', DeathLocation: 'Cork, Ireland' })],
  [11, p({ Id: 11, Name: 'Demo-Lynch-11', FirstName: 'Bridget', LastNameAtBirth: 'Lynch', Gender: 'Female', BirthDate: '1865-01-01', BirthLocation: 'Cork, Ireland', DeathDate: '1940-01-01', DeathLocation: 'Cork, Ireland' })],
  // Mary's sister: outside the direct line, so her recipe shows how relatives are labelled.
  [12, p({ Id: 12, Name: 'Demo-Murphy-12', FirstName: 'Bridget', LastNameAtBirth: 'Murphy', Gender: 'Female', BirthDate: '1928-02-02', BirthLocation: BOS, DeathDate: '2001-02-02', DeathLocation: BOS, Father: 4, Mother: 5 })],
]);
