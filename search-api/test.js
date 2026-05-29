async function get(url) {
    const res = await fetch(url);
    const data = await res.json();
    console.log(data);
}

get("https://portail.in")