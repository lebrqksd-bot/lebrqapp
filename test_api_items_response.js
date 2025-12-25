// Run this in browser console to check API response
fetch('http://localhost:8081/api/items')
  .then(r => r.json())
  .then(data => {
    console.log('========== API RESPONSE CHECK ==========');
    console.log('Total items:', data.items?.length || 0);
    
    if (data.items && data.items.length > 0) {
      const firstItem = data.items[0];
      console.log('\n📦 First Item:', firstItem.name);
      console.log('   ID:', firstItem.id);
      console.log('   Price:', firstItem.price);
      console.log('   Has item_status field?', 'item_status' in firstItem ? '✅ YES' : '❌ NO');
      console.log('   item_status value:', firstItem.item_status);
      console.log('   Has preparation_time_minutes?', 'preparation_time_minutes' in firstItem ? '✅ YES' : '❌ NO');
      console.log('   preparation_time_minutes value:', firstItem.preparation_time_minutes);
      
      console.log('\n📋 All Items Status:');
      data.items.forEach((item, i) => {
        console.log(`   ${i+1}. ${item.name}:`, 
          'status=' + (item.item_status || 'undefined'),
          'prep_time=' + (item.preparation_time_minutes || 0) + 'min'
        );
      });
    }
    
    console.log('\n🔍 Full first item object:');
    console.log(data.items[0]);
    console.log('========================================');
  })
  .catch(err => {
    console.error('❌ API Error:', err);
  });

