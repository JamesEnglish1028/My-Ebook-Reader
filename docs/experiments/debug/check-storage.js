console.log('=== CHECKING LOCALSTORAGE ===');
const registries = localStorage.getItem('ebook-registries');
const catalogs = localStorage.getItem('ebook-catalogs');
console.log('Registries:', registries);
console.log('Catalogs:', catalogs);
if (registries) {
  try {
    const parsed = JSON.parse(registries);
    console.log('Parsed registries:', JSON.stringify(parsed, null, 2));
  } catch (e) {
    console.error('Failed to parse registries');
  }
}
