// soonMessage.js
// Shows a floating message near the cursor when certain links are clicked
(function(){
  function showSoonMsg(e, lang) {
    e.preventDefault();
    var oldMsg = document.getElementById('soon-msg-popup');
    if (oldMsg) oldMsg.remove();
    var msg = document.createElement('div');
    msg.id = 'soon-msg-popup';
    msg.style.position = 'fixed';
    msg.style.zIndex = 9999;
    msg.style.background = '#222';
    msg.style.color = '#fff';
    msg.style.padding = '8px 16px';
    msg.style.borderRadius = '8px';
    msg.style.fontSize = '1rem';
    msg.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
    msg.style.pointerEvents = 'none';
    msg.style.transition = 'opacity 0.3s';
    msg.style.opacity = '1';
    msg.className = 'soon-msg-popup';
    msg.textContent = lang === 'he' ? '!פוסט ייעודי בנושא יעלה בקרוב. הישארו מעודכנים' : 'A dedicated post on this topic will be up soon. Stay tuned!';
    msg.style.left = (e.clientX + 12) + 'px';
    msg.style.top = (e.clientY - 8) + 'px';
    document.body.appendChild(msg);
    setTimeout(function(){
      msg.style.opacity = '0';
      setTimeout(function(){ msg.remove(); }, 600);
    }, 2200);
  }
  function addSoonMsgToLinks(selector) {
    document.querySelectorAll(selector).forEach(function(a){
      if (!a.hasAttribute('data-trimble-connect') && !a.hasAttribute('data-fabpackager-modal')) {
        a.addEventListener('click', function(e){
          var lang = 'en';
          var el = a;
          while (el && el !== document.body) {
            if (el.classList && el.classList.contains('lang-he')) { lang = 'he'; break; }
            if (el.classList && el.classList.contains('lang-en')) { lang = 'en'; break; }
            el = el.parentElement;
          }
          showSoonMsg(e, lang);
        });
      }
    });
  }
  window.soonMsgInit = function() {
    addSoonMsgToLinks('[data-dimensioning-post]');
    addSoonMsgToLinks('[data-advanced-scribing]');
    addSoonMsgToLinks('[data-fabrication-packager]');
    addSoonMsgToLinks('[data-hold-uda]');
  };
})();
