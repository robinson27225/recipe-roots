// A small synthetic family: the subject (living, id 1) -> mother -> grandparents.
// Nora and Patrick left Ireland; their daughter Mary was born in Boston.
const person = (o) => ({ IsLiving: 0, ...o });
export const people = new Map([
  [1, person({ Id: 1, Name: 'Sample-1', FirstName: 'Sam', LastNameAtBirth: 'Sample', BirthDate: '1985-01-01', BirthLocation: 'Boston, Suffolk, Massachusetts, United States', IsLiving: 1, Father: 2, Mother: 3 })],
  [2, person({ Id: 2, Name: 'Sample-2', FirstName: 'Frank', LastNameAtBirth: 'Sample', Gender: 'Male', BirthDate: '1955-05-05', BirthLocation: 'Worcester, Massachusetts, USA', DeathDate: '2015-02-02', DeathLocation: 'Worcester, Massachusetts, USA' })],
  [3, person({ Id: 3, Name: 'Murphy-10', FirstName: 'Mary', LastNameAtBirth: 'Murphy', Gender: 'Female', BirthDate: '1893-03-03', BirthLocation: 'Boston, Suffolk, Massachusetts, United States', DeathDate: '1970-01-01', DeathLocation: 'Boston, Massachusetts', Father: 4, Mother: 5 })],
  [4, person({ Id: 4, Name: 'Murphy-11', FirstName: 'Patrick', LastNameAtBirth: 'Murphy', Gender: 'Male', BirthDate: '1860-06-06', BirthLocation: 'Skibbereen, County Cork, Ireland', DeathDate: '1930-01-01', DeathLocation: 'Boston, Suffolk, Massachusetts, United States' })],
  // Nora: death unknown, but her child was born in Boston, so she must have moved.
  [5, person({ Id: 5, Name: 'Walsh-20', FirstName: 'Nora', LastNameAtBirth: 'Walsh', Gender: 'Female', BirthDate: '1865-04-04', BirthLocation: 'Cork, County Cork, Ireland' })],
]);
