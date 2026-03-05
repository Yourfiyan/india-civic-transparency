'use strict';

/**
 * Pre-generates a TopoJSON cache file from district geometries in the database.
 * Run after any district data load: node cache/generate-topojson.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const { topology } = require('topojson-server');
const { Pool } = require('pg');
const { logger } = require('../lib/logger');

const CACHE_DIR = process.env.CACHE_DIR || path.join(__dirname, 'static');
const OUTPUT_FILE = path.join(CACHE_DIR, 'india-districts.topojson');

async function generate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    logger.info('Generating TopoJSON cache from database...');

    const result = await pool.query(`
      SELECT id, name, state, census_code, population, area_sq_km,
             ST_AsGeoJSON(geom)::json AS geometry
      FROM districts
      WHERE geom IS NOT NULL
    `);

    if (result.rows.length === 0) {
      logger.warn('No district geometries found in database. Skipping TopoJSON generation.');
      return;
    }

    const geojson = {
      type: 'FeatureCollection',
      features: result.rows.map((row) => ({
        type: 'Feature',
        id: row.id,
        properties: {
          id: row.id,
          name: row.name,
          state: row.state,
          census_code: row.census_code,
          population: row.population,
          area_sq_km: row.area_sq_km,
        },
        geometry: row.geometry,
      })),
    };

    const topo = topology({ districts: geojson }, 1e5);

    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(topo));

    const sizeMB = (Buffer.byteLength(JSON.stringify(topo)) / 1024 / 1024).toFixed(2);
    logger.info({ path: OUTPUT_FILE, features: result.rows.length, sizeMB }, 'TopoJSON cache generated');
  } catch (err) {
    logger.error({ err }, 'Failed to generate TopoJSON cache');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

generate();
