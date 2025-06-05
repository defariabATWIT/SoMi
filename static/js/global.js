// Burger menu
document.getElementById("hamburger-menu").addEventListener("click", function() {
    document.getElementById("sidebar").classList.add("active");
});

document.getElementById("close-menu").addEventListener("click", function() {
    document.getElementById("sidebar").classList.remove("active");
});
