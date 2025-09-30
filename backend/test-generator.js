const { generate296FZFullReport } = require('./lib/enhanced-report-generator.js');

const testData = {
  organizationId: 'test-org-123',
  organizationName: 'ООО "Тестовая Компания"',
  documentId: 'doc-456',
  reportId: 'rep-789',
  period: '2024',
  methodology: '296-ФЗ от 02.07.2021',
  organizationInn: '1234567890',
  organizationAddress: 'г. Москва, ул. Тестовая, 1',
  emissionData: {
    scope1: 850.5,
    scope2: 1200.3,
    scope3: 350.7,
    total: 2401.5
  },
  variables: {
    responsible_person: 'Иванов И.И.',
    phone_number: '+7 495 123-45-67',
    email: 'test@example.com'
  }
};

console.log('🧪 Тестирование нового генератора отчетов...');

generate296FZFullReport(testData, { writeToDisk: false })
  .then(result => {
    if (result.success) {
      console.log('✅ Генератор работает успешно!');
      console.log('- HTML размер:', result.html?.length, 'символов');
      console.log('- PDF размер:', result.pdf?.length, 'байт');
      console.log('- Незамененные токены:', result.unreplacedTokens?.length || 0);
    } else {
      console.log('❌ Ошибка генерации:', result.error);
      if (result.templateErrors) {
        console.log('Ошибки шаблона:', result.templateErrors);
      }
    }
  })
  .catch(error => {
    console.error('💥 Критическая ошибка:', error.message);
  });