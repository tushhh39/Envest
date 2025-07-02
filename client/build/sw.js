// frontend/public/sw.js

self.addEventListener('push', e => {
    const data = e.data.json();
    console.log('Push Recieved...');
    self.registration.showNotification(data.title, {
        body: data.body,
        icon: data.icon, // You can specify an icon URL here
    });
});
