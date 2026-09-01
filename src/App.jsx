import { useMemo, useState } from "react";
import "./App.css";
import stateCodes from "./data/stateCodes.js";

const API_KEY = import.meta.env.VITE_CENSUS_API_KEY;

const formatNumber = (value) => {
  if (value === null || value === undefined || value === "N/A" || value === "Unavailable") {
    return "Unavailable";
  }

  const parsedValue = Number(value);
  if (Number.isNaN(parsedValue)) {
    return "Unavailable";
  }

  return new Intl.NumberFormat("en-US").format(parsedValue);
};

const formatCurrency = (value) => {
  if (value === null || value === undefined || value === "N/A" || value === "Unavailable") {
    return "Unavailable";
  }

  const parsedValue = Number(value);
  if (Number.isNaN(parsedValue)) {
    return "Unavailable";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(parsedValue);
};

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

  return "Unknown";
};

const getParksNearby = async (latitude, longitude) => {
  const radius = 16093;
  const query = `
    [out:json];
    (
      node["leisure"="park"](around:${radius},${latitude},${longitude});
      way["leisure"="park"](around:${radius},${latitude},${longitude});
      relation["leisure"="park"](around:${radius},${latitude},${longitude});
    );
    out;
  `;

  try {
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      return "Unavailable";
    }

    const data = await response.json();
    return Number.isFinite(data?.elements?.length) ? data.elements.length : "Unavailable";
  } catch (error) {
    return "Unavailable";
  }
};

const getCityData = async (city) => {
  const trimmedCity = city.trim();

  if (!trimmedCity) {
    return null;
  }

  const geoResponse = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmedCity)}&count=1&language=en&format=json`
  );

  if (!geoResponse.ok) {
    return null;
  }

  const geoData = await geoResponse.json();
  if (!geoData.results || geoData.results.length === 0) {
    return null;
  }

  const cityData = geoData.results[0];
  const latitude = cityData.latitude;
  const longitude = cityData.longitude;
  const stateCode = stateCodes[cityData.admin1];

  let medianRent = "Unavailable";
  let population = "Unavailable";

  if (stateCode && API_KEY) {
    try {
      const censusResponse = await fetch(
        `https://api.census.gov/data/2024/acs/acs5?get=NAME,B25064_001E,B01003_001E&for=place:*&in=state:${stateCode}&key=${API_KEY}`
      );

      if (censusResponse.ok) {
        const censusData = await censusResponse.json();
        const cityRow = censusData.find((row) => {
          const rowName = row[0]?.toLowerCase?.() ?? "";
          return rowName.startsWith(cityData.name.toLowerCase());
        });

        medianRent = cityRow && cityRow[1] ? cityRow[1] : "Unavailable";
        population = cityRow && cityRow[2] ? cityRow[2] : "Unavailable";
      }
    } catch (error) {
      medianRent = "Unavailable";
      population = "Unavailable";
    }
  }

  const parksNearby = await getParksNearby(latitude, longitude);

  let temperature = "Unavailable";
  let humidity = "Unavailable";
  let windSpeed = "Unavailable";
  let condition = "Unavailable";

  try {
    const weatherResponse = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&temperature_unit=fahrenheit`
    );

    if (weatherResponse.ok) {
      const weatherData = await weatherResponse.json();
      const current = weatherData.current ?? {};
      temperature = current.temperature_2m ?? "Unavailable";
      humidity = current.relative_humidity_2m ?? "Unavailable";
      windSpeed = current.wind_speed_10m ?? "Unavailable";
      condition = getWeatherCondition(current.weather_code);
    }
  } catch (error) {
    temperature = "Unavailable";
    humidity = "Unavailable";
    windSpeed = "Unavailable";
    condition = "Unavailable";
  }

  return {
    name: cityData.name,
    admin1: cityData.admin1,
    latitude,
    longitude,
    temperature,
    humidity,
    windSpeed,
    condition,
    medianRent,
    population,
    parksNearby,
  };
};

function MetricRow({ label, value, isComingSoon = false }) {
  return (
    <div className={`metric-row ${isComingSoon ? "metric-row-coming-soon" : ""}`}>
      <span>{label}</span>
      <strong>{isComingSoon ? <span className="coming-soon-pill">Coming Soon</span> : value}</strong>
    </div>
  );
}

function App() {
  const [cityOne, setCityOne] = useState("");
  const [cityTwo, setCityTwo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [firstCityResult, setFirstCityResult] = useState(null);
  const [secondCityResult, setSecondCityResult] = useState(null);

  const quickInsights = useMemo(() => {
    if (!firstCityResult || !secondCityResult) {
      return [];
    }

    const rentOne = Number(firstCityResult.medianRent);
    const rentTwo = Number(secondCityResult.medianRent);
    const populationOne = Number(firstCityResult.population);
    const populationTwo = Number(secondCityResult.population);
    const parksOne = Number(firstCityResult.parksNearby);
    const parksTwo = Number(secondCityResult.parksNearby);

    return [
      {
        title: "Median rent",
        leading: firstCityResult.name,
        trailing: secondCityResult.name,
        result:
          Number.isFinite(rentOne) && Number.isFinite(rentTwo)
            ? rentOne < rentTwo
              ? `${firstCityResult.name} has the lower median rent.`
              : `${secondCityResult.name} has the lower median rent.`
            : "Median rent data is not available for both cities yet.",
      },
      {
        title: "Population",
        leading: firstCityResult.name,
        trailing: secondCityResult.name,
        result:
          Number.isFinite(populationOne) && Number.isFinite(populationTwo)
            ? populationOne > populationTwo
              ? `${firstCityResult.name} is larger.`
              : `${secondCityResult.name} is larger.`
            : "Population data is not available for both cities yet.",
      },
      {
        title: "Nearby parks",
        leading: firstCityResult.name,
        trailing: secondCityResult.name,
        result:
          Number.isFinite(parksOne) && Number.isFinite(parksTwo)
            ? parksOne > parksTwo
              ? `${firstCityResult.name} has more parks nearby.`
              : `${secondCityResult.name} has more parks nearby.`
            : "Park data is not available for both cities yet.",
      },
    ];
  }, [firstCityResult, secondCityResult]);

  const handleCompare = async () => {
    const normalizedCityOne = cityOne.trim();
    const normalizedCityTwo = cityTwo.trim();

    if (!normalizedCityOne || !normalizedCityTwo) {
      setError("Please enter both city names before comparing.");
      return;
    }

    if (normalizedCityOne.toLowerCase() === normalizedCityTwo.toLowerCase()) {
      setError("Choose two different cities for a fair comparison.");
      return;
    }

    setLoading(true);
    setError("");
    setFirstCityResult(null);
    setSecondCityResult(null);

    try {
      const [firstCityData, secondCityData] = await Promise.all([
        getCityData(normalizedCityOne),
        getCityData(normalizedCityTwo),
      ]);

      if (!firstCityData || !secondCityData) {
        setError("One or both cities could not be found. Please check the names and try again.");
        return;
      }

      setFirstCityResult(firstCityData);
      setSecondCityResult(secondCityData);
    } catch (error) {
      setError("Something went wrong while loading the comparison. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const winnerMessage =
    firstCityResult && secondCityResult
      ? "We have enough basic data to compare the cities, but a final winner score needs additional trusted metrics like cost of living, walkability, and safety before it can be calculated fairly."
      : "Compare two cities to unlock the final winner breakdown.";

  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <div className="brand" aria-label="Stella Maris logo">
            <span className="brand-mark" aria-hidden="true">✦</span>
            <div>
              <h1>Stella Maris</h1>
              <p>Find where you belong.</p>
            </div>
          </div>
        </div>
      </header>

      <main className="page-shell">
        <section className="hero-card" aria-labelledby="hero-title">
          <div className="intro-copy">
            <p className="eyebrow">City comparison</p>
            <h2 id="hero-title">Discover your next chapter.</h2>
            <p className="subtitle">
              Compare destinations, explore daily life, and make your next move with confidence.
            </p>
          </div>

          <div className="search-form" onSubmit={(event) => event.preventDefault()}>
            <label className="city-field" htmlFor="city-one">
              <span>City one</span>
              <input
                id="city-one"
                type="text"
                value={cityOne}
                onChange={(event) => setCityOne(event.target.value)}
                placeholder="e.g. Seattle"
                aria-label="Enter first city"
              />
            </label>

            <div className="vs-pill" aria-label="versus">VS</div>

            <label className="city-field" htmlFor="city-two">
              <span>City two</span>
              <input
                id="city-two"
                type="text"
                value={cityTwo}
                onChange={(event) => setCityTwo(event.target.value)}
                placeholder="e.g. Austin"
                aria-label="Enter second city"
              />
            </label>
          </div>

          <div className="cta-row">
            <button
              type="button"
              className="primary-button"
              onClick={handleCompare}
              disabled={loading}
              aria-live="polite"
            >
              {loading ? "Comparing..." : "Compare Destinations"}
            </button>
          </div>

          {error ? (
            <p className="status-message error-message" role="alert" aria-live="assertive">
              {error}
            </p>
          ) : null}

          {loading ? <p className="status-message info-message">Loading city data and comparison insights…</p> : null}
        </section>

        {firstCityResult && secondCityResult ? (
          <section className="results-grid" aria-label="Comparison results">
            <article className="city-card">
              <div className="city-card-header">
                <div>
                  <p className="card-kicker">City One</p>
                  <h3>{firstCityResult.name}</h3>
                  <p className="region-name">{firstCityResult.admin1}</p>
                </div>
                <span className="weather-pill">{firstCityResult.condition}</span>
              </div>

              <div className="metric-list">
                <MetricRow label="Temperature" value={`${firstCityResult.temperature}°F`} />
                <MetricRow label="Humidity" value={`${firstCityResult.humidity}%`} />
                <MetricRow label="Wind" value={`${firstCityResult.windSpeed} mph`} />
                <MetricRow label="Median Rent" value={formatCurrency(firstCityResult.medianRent)} />
                <MetricRow label="Population" value={formatNumber(firstCityResult.population)} />
                <MetricRow label="Parks Nearby" value={formatNumber(firstCityResult.parksNearby)} />
                <MetricRow label="Cost of Living" isComingSoon />
                <MetricRow label="Walkability" isComingSoon />
                <MetricRow label="Safety Index" isComingSoon />
              </div>
            </article>

            <article className="city-card">
              <div className="city-card-header">
                <div>
                  <p className="card-kicker">City Two</p>
                  <h3>{secondCityResult.name}</h3>
                  <p className="region-name">{secondCityResult.admin1}</p>
                </div>
                <span className="weather-pill">{secondCityResult.condition}</span>
              </div>

              <div className="metric-list">
                <MetricRow label="Temperature" value={`${secondCityResult.temperature}°F`} />
                <MetricRow label="Humidity" value={`${secondCityResult.humidity}%`} />
                <MetricRow label="Wind" value={`${secondCityResult.windSpeed} mph`} />
                <MetricRow label="Median Rent" value={formatCurrency(secondCityResult.medianRent)} />
                <MetricRow label="Population" value={formatNumber(secondCityResult.population)} />
                <MetricRow label="Parks Nearby" value={formatNumber(secondCityResult.parksNearby)} />
                <MetricRow label="Cost of Living" isComingSoon />
                <MetricRow label="Walkability" isComingSoon />
                <MetricRow label="Safety Index" isComingSoon />
              </div>
            </article>
          </section>
        ) : null}

        <section className="panel winner-panel" aria-labelledby="winner-title">
          <p className="panel-eyebrow">Overall winner</p>
          <h2 id="winner-title">Not ready yet</h2>
          <p>{winnerMessage}</p>
        </section>

        {quickInsights.length > 0 ? (
          <section className="panel insights-panel" aria-labelledby="insights-title">
            <p className="panel-eyebrow">Quick insights</p>
            <h2 id="insights-title">What stands out right now</h2>
            <div className="insights-grid">
              {quickInsights.map((insight) => (
                <article key={insight.title} className="insight-card">
                  <p className="insight-title">{insight.title}</p>
                  <p className="insight-copy">{insight.result}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="panel next-steps-panel" aria-labelledby="next-steps-title">
          <p className="panel-eyebrow">Next steps</p>
          <h2 id="next-steps-title">Keep exploring</h2>
          <div className="action-stack">
            <button type="button" className="secondary-button" disabled>
              View Detailed Breakdown
            </button>
            <button type="button" className="secondary-button" disabled>
              Save Comparison
            </button>
            <button type="button" className="secondary-button" disabled>
              Share Comparison
            </button>
          </div>
        </section>
      </main>
    </>
  );
}

export default App;