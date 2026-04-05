use crate::config::Config;
use crate::storage::ScreenTimeRecord;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
struct SyncPayload {
    entries: Vec<SyncEntry>,
    locatie: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SyncEntry {
    client_id: String,
    app: String,
    venstertitel: String,
    url: Option<String>,
    start_tijd: String,
    eind_tijd: String,
    duur_seconden: i64,
}

#[derive(Debug, Deserialize)]
struct SyncResponse {
    verwerkt: i64,
    overgeslagen: i64,
}

pub async fn sync_entries(records: &[ScreenTimeRecord], config: &Config) -> Result<(i64, i64), String> {
    if records.is_empty() {
        return Ok((0, 0));
    }

    let entries: Vec<SyncEntry> = records.iter().map(|r| SyncEntry {
        client_id: r.client_id.clone(),
        app: r.app.clone(),
        venstertitel: r.title.clone(),
        url: r.url.clone(),
        start_tijd: r.start_time.clone(),
        eind_tijd: r.end_time.clone(),
        duur_seconden: r.duration_secs,
    }).collect();

    let client = reqwest::Client::new();
    let url = format!("{}/api/screen-time/sync", config.api_url);

    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", config.api_token))
        .header("Content-Type", "application/json")
        .json(&SyncPayload { entries, locatie: config.locatie.clone() })
        .send()
        .await
        .map_err(|e| format!("Sync fout: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Sync mislukt ({}): {}", status, body));
    }

    let result: SyncResponse = response.json().await.map_err(|e| e.to_string())?;

    Ok((result.verwerkt, result.overgeslagen))
}
