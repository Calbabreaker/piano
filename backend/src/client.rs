use std::{collections::HashMap, sync::Arc};

use tokio::sync::{RwLock, RwLockReadGuard, RwLockWriteGuard, mpsc::UnboundedSender};

use crate::websocket::ServerMessage;

#[derive(Default)]
pub struct GlobalState {
    pub rooms: HashMap<String, ClientList>,
}

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
        message: ServerMessage<'_>,
        self_id: u32,
    ) -> anyhow::Result<()> {
        for client in self.get().await.iter() {
            if self_id == client.id {
                continue;
            }

            client.ws_sender.send(rmp_serde::to_vec_named(&message)?)?;
        }

        Ok(())
    }

    /// Removes a client by an id
    pub async fn remove(&self, id: u32) -> anyhow::Result<()> {
        let index = self.get_index(id).await?;
        self.get_mut().await.swap_remove(index);
        Ok(())
    }

    pub async fn get_index(&self, id: u32) -> anyhow::Result<usize> {
        let index = self.get().await.iter().position(|client| client.id == id);
        index.ok_or_else(|| anyhow::anyhow!("No client found"))
    }

    pub async fn get(&self) -> RwLockReadGuard<'_, Vec<ClientData>> {
        self.0.read().await
    }

    pub async fn get_mut(&self) -> RwLockWriteGuard<'_, Vec<ClientData>> {
        self.0.write().await
    }
}
