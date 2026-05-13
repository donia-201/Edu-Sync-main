window.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.querySelector('.theme-toggle-btn');
  const icon = toggleBtn.querySelector('i');

  if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-theme');
    icon.classList.remove('fa-sun');
    icon.classList.add('fa-moon');
  }
 if(toggleBtn){
  toggleBtn.addEventListener("click" ,()=>{
    document.body.classList.toggle("dark-theme");
    if(document.body.classList.contains("dark-theme")){
    localStorage.setItem("theme", "dark");
    icon.classList.remove('fa-sun');
    icon.classList.add('fa-moon');
  } else {
    localStorage.setItem("theme" , "light");
      icon.classList.add('fa-sun');
      icon.classList.remove('fa-moon');
  }
});
 }
});