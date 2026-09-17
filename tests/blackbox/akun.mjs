// Akun uji black box. Dibiarkan tetap ada setelah pengujian.
// Nama diambil dari daftar yang diberikan; 'desfian' sengaja tidak dibuat
// karena sudah terpakai dan dipakai untuk skenario username duplikat,
// 'alfin' terpakai sehingga memakai 'alfinr', dan 'haikal' didaftarkan
// lewat antarmuka pada skenario B.1.
export const PASSWORD = 'Summity123';
export const AKUN = [
  { username: 'lubna',    name: 'Lubna',    gender: 'Perempuan' },
  { username: 'amani',    name: 'Amani',    gender: 'Perempuan' },
  { username: 'jennaira', name: 'Jennaira', gender: 'Perempuan' },
  { username: 'iqbal',    name: 'Iqbal',    gender: 'Laki-laki' },
  { username: 'rendita',  name: 'Rendita',  gender: 'Perempuan' },
  { username: 'nabila',   name: 'Nabila',   gender: 'Perempuan' },
  { username: 'najwa',    name: 'Najwa',    gender: 'Perempuan' },
  { username: 'hania',    name: 'Hania',    gender: 'Perempuan' },
  { username: 'rivera',   name: 'Rivera',   gender: 'Laki-laki' },
  { username: 'zaki',     name: 'Zaki',     gender: 'Laki-laki' },
  { username: 'ferry',    name: 'Ferry',    gender: 'Laki-laki' },
  { username: 'obailo',   name: 'Oba Ilo',  gender: 'Laki-laki' },
  { username: 'alfinr',   name: 'Alfin',    gender: 'Laki-laki' },
  { username: 'agung',    name: 'Agung',    gender: 'Laki-laki' },
  { username: 'adam',     name: 'Adam',     gender: 'Laki-laki' },
  { username: 'paiz',     name: 'Paiz',     gender: 'Laki-laki' },
];
export const emailOf = (u) => `${u}@summity.id`;
