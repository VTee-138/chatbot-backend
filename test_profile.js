const fetch = require('node-fetch');

async function testProfile() {
  try {
    console.log('🧪 Testing profile endpoint...');
    
    const response = await fetch('http://localhost:8000/api/v1/auth/profile', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer dummy-token',
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    console.log('📊 Status:', response.status);
    console.log('📋 Response:', JSON.stringify(result, null, 2));
    
    if (result.success && result.data) {
      console.log('✅ Profile API working correctly!');
      console.log('👤 User data keys:', Object.keys(result.data));
    } else {
      console.log('❌ Profile API returned null data');
    }
    
  } catch (error) {
    console.error('❌ Error testing profile:', error.message);
  }
}

testProfile();