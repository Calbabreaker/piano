use std::sync::Arc;

use tokio::sync::{mpsc::UnboundedSender, RwLock, RwLockReadGuard, RwLockWriteGuard};

use crate::websocket::WebsocketMessage;

#[derive(Clone, serde::Serialize, Debug, ts_rs::TS)]
#[ts(export_to = "../../frontend/src/server_bindings.ts")]
pub struct ClientData {
    pub color_hue: u16,
    pub id: u32,
    pub instrument_name: String,
    #[serde(skip)]
    pub ws_sender: UnboundedSender<Vec<u8>>,
}

#[derive(Default, Clone, Debug)]
pub struct ClientList(Arc<RwLock<Vec<ClientData>>>);

impl ClientList {
    pub async fn send_to_all(
        &self,
        message: &WebsocketMessage<'_>,
        self_id: u32,
    ) -> anyhow::Result<()> {
        for client in self.0.read().await.iter() {
            if self_id == client.id {
                continue;
            }

            client.ws_sender.send(rmp_serde::to_vec_named(&message)?)?;
        }

        Ok(())
    }

    /// Removes a client by an id
    pub async fn remove(&self, id: u32) -> anyhow::Result<()> {
        let mut client_list = self.get_mut().await;
        let index = client_list.iter().position(|client| client.id == id);
        let index = index.ok_or_else(|| anyhow::anyhow!("No client found"))?;
        client_list.swap_remove(index);
        Ok(())
    }

    pub async fn get(&self) -> RwLockReadGuard<'_, Vec<ClientData>> {
        self.0.read().await
    }

    pub async fn get_mut(&self) -> RwLockWriteGuard<'_, Vec<ClientData>> {
        self.0.write().await
    }
}
