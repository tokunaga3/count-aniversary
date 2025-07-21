
interface Task {
    id: number; // ユニークなID（自動採番など）
    title: string; // タスクのタイトル
    // completed: boolean; // 完了状態
  };
  
  const tasks: Task[] = [];
  
  
  // GET /tasks:
  export const getTasks = (): Task[] => {
    
    tasks[0] = {
      id: 1,
      title: "test",
      // completed: false
    };
  
    // console.log(tasks)
    return JSON.stringify(tasks);
  }