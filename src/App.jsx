import { useState } from "react";
import "./App.css";
import stateCodes from "./data/stateCodes.js";
const API_KEY = import.meta.env.VITE_CENSUS_API_KEY;

function App() {
  const [cityOne, setCityOne] = useState("");
  const [cityTwo, setCityTwo] = useState(""); 

  const [firstCityResult, setFirstCityResult] = useState(null);
  const [secondCityResult, setSecondCityResult] = useState(null);

  const getWeatherCondition = (code) => { 
    if (code === 0) return "Clear";
    if (code >= 1 && code <= 3) return "Partly Cloudy";
    if (code >= 45 && code <= 48) return "Foggy";
    if (code >= 51 && code <= 57) return "Drizzle";
    if (code >= 61 && code <= 67) return "Rainy";
    if (code >= 71 && code <= 77) return "Snowy";
    if (code >= 80 && code <= 82) return "Rain Showers";
    if (code >= 85 && code <= 86) return "Snow Showers";
    if (code === 95) return "Thunderstorm";
    if (code >= 96 && code <= 99) return "Severe Thunderstorm";

    return "Unknown Weather Condition"; 
  }

  const getCityData = async (city) => { 
    const response = await fetch( 
      `https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=1&language=en&format=json`
    );
    const data = await response.json();

    
    if (!data.results) {
      return null;
    }

    const cityData = data.results[0];
    const stateCode = stateCodes[cityData.admin1];
    const censusResponse = await fetch(
      `https://api.census.gov/data/2024/acs/acs5?get=NAME,B25064_001E,B01003_001E&for=place:*&in=state:${stateCode}&key=${API_KEY}`
    );

    const censusData = await censusResponse.json();
    const cityRow = censusData.find((row) => row[0].toLowerCase().startsWith(cityData.name.toLowerCase()) 
  ); 

    const medianRent = cityRow ? cityRow[1] : "N/A";
    const population = cityRow ? cityRow[2] : "N/A";

    const latitude = cityData.latitude;
    const longitude = cityData.longitude; 
    const parksNearby = await getParksNearby(latitude, longitude);

    const weatherResponse = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&temperature_unit=fahrenheit`
    );

    const weatherData = await weatherResponse.json(); 
    const temperature = weatherData.current.temperature_2m;
    const humidity = weatherData.current.relative_humidity_2m;
    const windSpeed = weatherData.current.wind_speed_10m;
    const weatherCode = weatherData.current.weather_code;
    const condition = getWeatherCondition(weatherCode);

    return {
      name:cityData.name,
      admin1: cityData.admin1,
      latitude: latitude,
      longitude: longitude,
      temperature: temperature,
      humidity: humidity,
      windSpeed: windSpeed, 
      weatherCode: weatherCode,
      condition: condition,
      medianRent: medianRent,
      population: population,
      parksNearby: parksNearby
    };
  }; 

const getParksNearby= async (latitude, longitude) => {
  const radius = 16093; //10 mile radius in meters
  const query =`
  [out:json];
  (
    node["leisure"="park"](around:${radius},${latitude},${longitude});
    way["leisure"="park"](around:${radius},${latitude},${longitude});
    relation["leisure"="park"](around:${radius},${latitude},${longitude});
  );
  out;
  `; 

  const response = await fetch( 
    "https://overpass.private.coffee/api/interpreter",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `data=${encodeURIComponent(query)}`,
    }
  ); 
  if (!response.ok) {
    return "unavailable";
  }
  const data = await response.json();
  return data.elements.length;
};

  const handleCompare = async () => { 
    const firstCityData = await getCityData(cityOne);
    const secondCityData = await getCityData(cityTwo); 

    if (!firstCityData || !secondCityData) {
      return; 
    }

    setFirstCityResult(firstCityData);
    setSecondCityResult(secondCityData); 
    };

  return ( 
    <> 
    <header>
  <div className="logo">
    <span className="star">✦</span>

    <h1>Stella Maris</h1>

    <p>Find where you belong.</p>
  </div>
</header>

<main> 
  <section className="hero">
  <h2>Discover Your Next Chapter</h2>

  <p> 
  Compare destinations, explore lifestyles,and make your next move with confidence.
  </p> 

  <div className="search-boxes">
    <input 
     type="text"
     placeholder="Enter first city"
     value={cityOne}
     onChange={(e) => setCityOne(e.target.value)} />

     <span className="vs">VS</span> 

     <input 
     type="text"
     placeholder="Enter second city"
     value={cityTwo}
     onChange={(e) => setCityTwo(e.target.value)} />

</div> 
    <button onClick={handleCompare}>Compare Destinations</button>
  </section> 

  {firstCityResult && ( 
    <section className="results">

      <div className="city-card">
        <h3>{firstCityResult.name}</h3>
        <p>{firstCityResult.admin1}</p>
        <p>Temperature: {firstCityResult.temperature}°F</p>
        <p>Humidity: {firstCityResult.humidity}%</p>
        <p>Wind Speed: {firstCityResult.windSpeed} mph</p>
        <p>Weather Condition: {firstCityResult.condition}</p>
        <p>Median Rent: ${firstCityResult.medianRent}</p> 
        <p>Cost of Living Index: Coming Soon</p>
        <p>Population: {firstCityResult.population}</p>
        <p>Parks Nearby: {firstCityResult.parksNearby}</p>
        <p>Walkability Score: Coming Soon</p>
        <p>Safety Index: Coming Soon</p>
      </div>

  {secondCityResult && ( 
    <div className="city-card">
      <h3>{secondCityResult.name}</h3>
      <p>{secondCityResult.admin1}</p>
      <p>Temperature: {secondCityResult.temperature}°F</p>
      <p>Humidity: {secondCityResult.humidity}%</p>
      <p>Wind Speed: {secondCityResult.windSpeed} mph</p>
      <p>Weather Condition: {secondCityResult.condition}</p>
      <p>Median Rent: ${secondCityResult.medianRent}</p>
      <p>Cost of Living Index: Coming Soon</p>
      <p>Population: {secondCityResult.population}</p>
      <p>Parks Nearby: {secondCityResult.parksNearby}</p>
      <p>Walkability Score: Coming Soon</p>
      <p>Safety Index: Coming Soon</p>
    </div>
  )}

    </section> 

    
  )}
  <section className="winner-section">
    <h2>Overall Winner</h2>
    <p>Winner Comming Soon!</p>
  </section> 

  {firstCityResult && secondCityResult && (

<section className="insights-section">
  <h2>Quick Insights</h2>
  <div className="insights-list">
    <p> {Number(firstCityResult.medianRent) < Number(secondCityResult.medianRent)
    ? `${firstCityResult.name} has a lower median rent.`
    : `${secondCityResult.name} has a lower median rent.`
    }</p>

    <p> {Number(firstCityResult.population) > Number(secondCityResult.population)
    ? `${firstCityResult.name} has a larger population.`
    : `${secondCityResult.name} has a larger population.`
    }</p>

    <p> {Number(firstCityResult.parksNearby) > Number(secondCityResult.parksNearby)
    ? `${firstCityResult.name} has more parks nearby.`
    : `${secondCityResult.name} has more parks nearby.`
    }</p>


  </div>
  </section>
)} 

<section className="next-steps-section">
  <h2>Next Steps</h2>
  <button>View Detailed Breakdown</button>
  <button>Save Comparison</button>
  <button>Share Comparison</button>
</section>
</main>
    </>
  );
}
export default App;