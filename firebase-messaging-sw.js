/**
 * 하나로 메신저 — 웹 푸시 수신용 서비스워커
 *
 * ⚠️ 이 파일은 반드시 **사이트 루트**에 있어야 한다.
 *    Firebase Messaging이 `/firebase-messaging-sw.js` 를 기본 경로로 찾는다.
 *    (GitHub Pages 배포이므로 리포 루트 = 사이트 루트)
 *
 * ⚠️ **fetch 이벤트 핸들러를 넣지 말 것.**
 *    루트에 등록되면 스코프가 사이트 전체(`/`)라, fetch를 가로채는 순간
 *    홈페이지 모든 페이지의 네트워크 요청이 이 파일을 거치게 된다.
 *    캐싱 로직을 잘못 넣으면 옛 페이지가 계속 서빙되는 사고로 이어진다.
 *    여기서는 **푸시 수신과 클릭 처리만** 한다.
 *
 * 등록은 메신저 페이지(hanaro/messenger/messenger.html)에서만 한다.
 * 다른 페이지는 이 워커를 등록하지 않으므로 영향을 받지 않는다.
 */

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// 서비스워커는 페이지의 스크립트를 공유하지 않으므로 설정을 다시 적는다.
// (auth.js 의 firebaseConfig 와 같은 값 — 웹 API 키는 공개되어도 되는 식별자다)
firebase.initializeApp({
    apiKey: "AIzaSyD-FTnZJKNXJHz-FTzuLXPk4n7uTbVrA68",
    authDomain: "hanarooa-f227d.firebaseapp.com",
    projectId: "hanarooa-f227d",
    storageBucket: "hanarooa-f227d.firebasestorage.app",
    messagingSenderId: "224725591655",
    appId: "1:224725591655:web:946b6b462c2ad06a8f56c2"
});

const messaging = firebase.messaging();

// 탭이 백그라운드일 때 도착하는 메시지.
// 서버가 notification 을 함께 보내면 브라우저가 알아서 띄우므로,
// 여기서는 data 만 온 경우를 대비한 보완 처리다.
messaging.onBackgroundMessage(function (payload) {
    const data = payload.data || {};
    const title = data.title || '하나로 메신저';
    const options = {
        body: data.body || '',
        icon: '/image/logo.png',
        badge: '/image/logo.png',
        tag: data.roomId || 'hanaro-messenger',   // 같은 방 알림은 하나로 합친다
        data: { roomId: data.roomId || '' }
    };
    return self.registration.showNotification(title, options);
});

// 알림 클릭 — 이미 열려 있는 메신저 탭이 있으면 그 탭을 살린다.
self.addEventListener('notificationclick', function (event) {
    event.notification.close();

    const target = '/hanaro/messenger/messenger.html';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
            for (const client of list) {
                if (client.url.indexOf('/hanaro/messenger/') !== -1 && 'focus' in client) {
                    return client.focus();
                }
            }
            if (self.clients.openWindow) return self.clients.openWindow(target);
        })
    );
});
